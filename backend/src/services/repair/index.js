import { shortHash } from '../../utils/hash.js';
import { RULE_TEMPLATES } from '../scanner/templates/rules.js';
import { createContext, manual } from './context.js';
import {
  applyEdits,
  attrInsertPoint,
  changedLines,
  cssBlockEdit,
  escapeAttr,
  unifiedDiff,
} from './edits.js';
import * as accessibleName from './rules/accessibleName.js';
import * as colorContrast from './rules/colorContrast.js';
import * as documentLang from './rules/documentLang.js';
import * as documentTitle from './rules/documentTitle.js';
import * as duplicateId from './rules/duplicateId.js';
import * as formLabel from './rules/formLabel.js';
import * as headingLevels from './rules/headingLevels.js';
import * as imageAlt from './rules/imageAlt.js';
import * as linkContext from './rules/linkContext.js';
import * as simpleAttributes from './rules/simpleAttributes.js';

const FIXERS = [
  linkContext,
  colorContrast,
  documentLang,
  documentTitle,
  formLabel,
  headingLevels,
  imageAlt,
  accessibleName,
  duplicateId,
  simpleAttributes,
];
const BY_RULE = new Map(FIXERS.flatMap((f) => f.ruleIds.map((id) => [id, f])));

export const SUPPORTED_RULES = [...BY_RULE.keys()];

const KIND = {
  'color-contrast': 'css',
  'html-has-lang': 'document',
  'html-lang-valid': 'document',
  'document-title': 'document',
};

/** Fallback for rules with no fixer: say why and what to check. */
function noFixer(v) {
  const t = RULE_TEMPLATES[v.ruleId];
  return manual('There is no safe automated fix for this rule yet.', [
    t ? t.explanation : v.explanation,
    'See the rule reference for the exact requirement.',
  ]);
}

/**
 * Full patched text for a set of edits plus the shared helper CSS they need.
 * @param {ReturnType<typeof createContext>} ctx
 */
export function render(ctx, edits, css) {
  return applyEdits(ctx.source, [...edits, ...cssBlockEdit(ctx.$, ctx.source, css)]);
}

/**
 * One Repair per violation: a deterministic patch, a template with a TODO
 * placeholder, or a manual-review verdict. Never more than one, never none.
 * Internal fields (prefixed `_`) stay on the server.
 *
 * @param {{ scan: object, source: string, violations: object[] }} input
 */
export function proposeRepairs({ scan, source, violations }) {
  const ctx = createContext({ source, scan });
  const createdAt = new Date().toISOString();

  return violations.map((v) => {
    const fixer = BY_RULE.get(v.ruleId);
    let proposal;
    try {
      proposal = fixer ? fixer.propose(v, ctx) : noFixer(v);
    } catch (err) {
      proposal = manual(`The automatic fix could not be built (${err.message}).`);
    }

    const base = {
      id: `r_${shortHash(`${scan.id}|${v.id}`)}`,
      violationId: v.id,
      ruleId: v.ruleId,
      tokenUsage: null,
      verification: null,
      createdAt,
    };

    if (proposal.kind === 'manual') {
      return {
        ...base,
        strategy: 'manual',
        status: 'manual-review',
        confidence: 'low',
        patch: null,
        rationale: proposal.reason,
        notes: proposal.howToCheck,
        needsHumanInput: true,
        placeholder: null,
        draft: null,
        accepted: false,
        _edits: [],
        _css: [],
        _markPos: null,
      };
    }

    const edits = proposal.edits.filter(Boolean);
    const after = render(ctx, edits, proposal.css);
    const diff = unifiedDiff(source, after);
    const lines = changedLines(source, after);
    const isTemplate = proposal.strategy === 'template';
    return {
      ...base,
      strategy: proposal.strategy,
      status: isTemplate ? 'needs-input' : 'proposed',
      confidence: proposal.confidence,
      patch: {
        kind: KIND[v.ruleId] ?? 'element',
        target: v.node.target,
        before: lines.before,
        after: lines.after,
        diff,
        copy: `${proposal.explanation}\n\n${diff}`,
      },
      rationale: proposal.explanation,
      notes: proposal.notes ?? [],
      needsHumanInput: isTemplate || proposal.confidence !== 'high',
      placeholder: proposal.placeholder ?? null,
      draft: null,
      accepted: false,
      _edits: edits,
      _css: proposal.css ?? [],
      _markPos: proposal.mark?.sourceCodeLocation ? attrInsertPoint(source, proposal.mark) : null,
    };
  });
}

/**
 * A template repair with the user's words in place of its TODO placeholder.
 * Returns a new repair; the stored one is untouched.
 */
function withReplacedText(repair, from, text, { scan, source }) {
  const ctx = createContext({ source, scan });
  const to = escapeAttr(text);
  const edits = repair._edits.map((e) => ({ ...e, text: e.text.replaceAll(from, to) }));
  const after = render(ctx, edits, repair._css);
  const diff = unifiedDiff(source, after);
  const lines = changedLines(source, after);
  const rationale = `${repair.rationale.split('. ')[0]} with your text: "${text}".`;
  return {
    ctx,
    edits,
    after,
    diff,
    lines,
    rationale,
    to,
  };
}

export function fillPlaceholder(repair, text, { scan, source }) {
  const from = repair.draft ? repair._inserted : repair.placeholder;
  const { edits, diff, lines, rationale, to } = withReplacedText(repair, from, text, { scan, source });
  return {
    ...repair,
    strategy: repair.strategy === 'llm' ? 'llm' : 'deterministic',
    status: 'proposed',
    rationale,
    placeholder: null,
    draft: text,
    accepted: repair.strategy === 'llm' ? true : repair.accepted,
    patch: { ...repair.patch, before: lines.before, after: lines.after, diff, copy: `${rationale}\n\n${diff}` },
    _edits: edits,
    _inserted: to,
  };
}

/** Fill a template with LLM-drafted words. Stays needs-input until the user accepts. */
export function applyLlmDraft(repair, text, confidence, { scan, source }) {
  const { edits, diff, lines, rationale, to } = withReplacedText(
    repair,
    repair.placeholder,
    text,
    { scan, source },
  );
  return {
    ...repair,
    strategy: 'llm',
    status: 'needs-input',
    confidence,
    rationale,
    notes: [...repair.notes, 'AI draft: check that the wording is accurate before applying.'],
    needsHumanInput: true,
    placeholder: repair.placeholder,
    draft: text,
    accepted: false,
    patch: { ...repair.patch, before: lines.before, after: lines.after, diff, copy: `${rationale}\n\n${diff}` },
    _edits: edits,
    _inserted: to,
    _todoPlaceholder: repair.placeholder,
    _todoEdits: repair._edits,
    _todoPatch: repair.patch,
    _todoRationale: repair.rationale,
  };
}

export function restoreTemplate(repair) {
  if (!repair._todoEdits) return repair;
  return {
    ...repair,
    strategy: 'template',
    status: 'needs-input',
    confidence: 'low',
    rationale: repair._todoRationale ?? repair.rationale,
    notes: repair.notes.filter((n) => !n.startsWith('AI draft:')),
    placeholder: repair._todoPlaceholder,
    draft: null,
    accepted: false,
    patch: repair._todoPatch ?? repair.patch,
    _edits: repair._todoEdits,
    _inserted: null,
  };
}

/** Strip server-only fields before a repair leaves the API. */
export function toPublicRepair(r) {
  return Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));
}

export { createContext };
