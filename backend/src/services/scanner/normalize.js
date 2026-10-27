import { shortHash } from '../../utils/hash.js';
import { patternSignature } from './signature.js';
import { RULE_TEMPLATES, describeRule } from './templates/rules.js';
import { criterionFromTag, criterionRef } from './templates/wcag.js';

const MAX_SNIPPET = 2000;
const LEVEL_TAGS = [
  ['A', ['wcag2a', 'wcag21a', 'wcag22a']],
  ['AA', ['wcag2aa', 'wcag21aa', 'wcag22aa']],
  ['AAA', ['wcag2aaa', 'wcag21aaa', 'wcag22aaa']],
];
const IMPACTS = new Set(['critical', 'serious', 'moderate', 'minor']);

function wcagFromTags(tags) {
  const criteria = [...new Set(tags.map(criterionFromTag).filter(Boolean))];
  const level = LEVEL_TAGS.find(([, t]) => t.some((x) => tags.includes(x)))?.[0] ?? null;
  return { criteria, level, refs: criteria.map(criterionRef) };
}

const truncate = (s) => (s.length > MAX_SNIPPET ? `${s.slice(0, MAX_SNIPPET - 1)}…` : s);

function build({
  inputHash,
  ruleId,
  source,
  outcome,
  category,
  impact,
  wcag,
  text,
  helpUrl,
  node,
}) {
  const targetKey = JSON.stringify(node.target);
  return {
    id: `v_${shortHash(`${inputHash}|${ruleId}|${outcome}|${targetKey}`)}`,
    ruleId,
    source,
    outcome,
    category,
    impact: IMPACTS.has(impact) ? impact : 'moderate',
    wcag,
    title: text.title,
    explanation: text.explanation,
    whoItAffects: text.whoItAffects,
    helpUrl: helpUrl ? helpUrl.split('?')[0] : null,
    node: {
      target: node.target.map((t) => (Array.isArray(t) ? t.join(' >>> ') : String(t))),
      html: truncate(node.html ?? ''),
      failureSummary: node.failureSummary ?? null,
    },
    signature: patternSignature(ruleId, node.html ?? ''),
    status: outcome === 'needs-review' ? 'manual-review' : 'open',
  };
}

function fromAxe(results, outcome, inputHash) {
  return results.flatMap((rule) => {
    const wcag = wcagFromTags(rule.tags);
    const category = wcag.criteria.length && wcag.level ? 'wcag' : 'best-practice';
    const text = describeRule(rule.id, rule);
    return rule.nodes.map((node) => ({
      afxId: node.afxId ?? null,
      violation: build({
        inputHash,
        ruleId: rule.id,
        source: 'axe',
        outcome,
        category,
        impact: node.impact ?? rule.impact,
        wcag,
        text,
        helpUrl: rule.helpUrl,
        node,
      }),
    }));
  });
}

function fromFindings(findings, inputHash) {
  return findings.map((f) => {
    const criteria = RULE_TEMPLATES[f.ruleId]?.criteria ?? [];
    return build({
      inputHash,
      ruleId: f.ruleId,
      source: 'accessfix',
      outcome: 'violation',
      category: 'best-practice',
      impact: f.impact,
      wcag: { criteria, level: null, refs: criteria.map(criterionRef) },
      text: describeRule(f.ruleId),
      helpUrl: null,
      node: f,
    });
  });
}

/**
 * Raw engine output -> contract Violations, split into the three buckets.
 * IDs are stable for the same input, rule and element. Our findings are
 * dropped when axe already reported an overlapping rule on the same element.
 *
 * @param {import('./index.js').RawScanResult} raw
 * @param {{ inputHash: string }} ctx
 */
export function normalize(raw, { inputHash }) {
  const axeViolations = fromAxe(raw.violations, 'violation', inputHash);
  const axeIncomplete = fromAxe(raw.incomplete, 'needs-review', inputHash);

  const reported = new Set(
    axeViolations.filter((x) => x.afxId !== null).map((x) => `${x.violation.ruleId}@${x.afxId}`),
  );
  const ours = raw.findings.filter(
    (f) => !f.overlaps.some((ruleId) => reported.has(`${ruleId}@${f.afxId}`)),
  );

  const seen = new Set();
  const unique = (v) => !seen.has(v.id) && seen.add(v.id);

  const all = [...axeViolations.map((x) => x.violation), ...fromFindings(ours, inputHash)].filter(
    unique,
  );
  return {
    violations: all.filter((v) => v.category === 'wcag'),
    advisory: all.filter((v) => v.category === 'best-practice'),
    manualReview: axeIncomplete.map((x) => x.violation).filter(unique),
  };
}
