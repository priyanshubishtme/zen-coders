import { manual, patch } from '../context.js';
import { renameTag, setAttr } from '../edits.js';

export const ruleIds = ['heading-order', 'afx-heading-skip', 'afx-heading-multiple-h1'];

/** Browser defaults, used when the scan has no computed style for the heading. */
const UA = {
  1: { fontSize: '2em', fontWeight: '700', marginTop: '0.67em', marginBottom: '0.67em' },
  2: { fontSize: '1.5em', fontWeight: '700', marginTop: '0.83em', marginBottom: '0.83em' },
  3: { fontSize: '1.17em', fontWeight: '700', marginTop: '1em', marginBottom: '1em' },
  4: { fontSize: '1em', fontWeight: '700', marginTop: '1.33em', marginBottom: '1.33em' },
  5: { fontSize: '0.83em', fontWeight: '700', marginTop: '1.67em', marginBottom: '1.67em' },
  6: { fontSize: '0.67em', fontWeight: '700', marginTop: '2.33em', marginBottom: '2.33em' },
};

const levelOf = (el) => Number(el.tagName[1]);

/** The computed look of a heading from the scan, so the new level can keep it. */
function lookOf(ctx, el) {
  for (const h of ctx.scan.headingOutline ?? []) {
    if (!h.style) continue;
    try {
      const found = ctx.$(h.target[0]);
      if (found.length === 1 && found[0] === el) return h.style;
    } catch {
      // ignore unmatchable selectors
    }
  }
  return UA[levelOf(el)];
}

function keepLook(ctx, el, oldLevel, edits, css) {
  const cls = `afx-h${oldLevel}`;
  const classes = el.attribs.class ? `${el.attribs.class} ${cls}` : cls;
  edits.push(setAttr(ctx.source, el, 'class', classes));
  const s = lookOf(ctx, el);
  css.push({
    key: `${cls}:${s.fontSize}:${s.fontWeight}`,
    css: `.${cls}{font-size:${s.fontSize};font-weight:${s.fontWeight};margin-top:${s.marginTop};margin-bottom:${s.marginBottom}}`,
  });
}

/**
 * Re-level a heading (and the headings nested under it) so the outline has no
 * gaps, keeping each heading's original look with a class. Native tags only.
 */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation?.endTag || !/^h[1-6]$/.test(el.tagName)) {
    return manual('This heading is not a native h1–h6 in the source, so its level must be changed where it is rendered.');
  }

  const headings = ctx
    .$('h1,h2,h3,h4,h5,h6')
    .toArray()
    .filter((h) => h.sourceCodeLocation);
  const i = headings.indexOf(el);
  const oldLevel = levelOf(el);

  const demote = v.ruleId === 'afx-heading-multiple-h1';
  let newLevel;
  if (demote) newLevel = 2;
  else {
    const prev = headings.slice(0, i).at(-1);
    newLevel = prev ? levelOf(prev) + 1 : 1;
  }
  if (demote ? oldLevel !== 1 : newLevel >= oldLevel) {
    return manual('The heading level is already in sequence in the source.');
  }

  const delta = newLevel - oldLevel;
  const edits = [];
  const css = [];
  const changed = [];
  for (const h of [el, ...headings.slice(i + 1)]) {
    const level = levelOf(h);
    if (h !== el && level <= oldLevel) break;
    const to = Math.min(6, Math.max(1, level + delta));
    edits.push(...renameTag(h, `h${to}`));
    keepLook(ctx, h, level, edits, css);
    changed.push(`h${level}→h${to}`);
  }

  const nested = changed.length - 1;
  return patch({
    strategy: 'deterministic',
    confidence: 'medium',
    mark: el,
    edits,
    css,
    explanation:
      `Changes <h${oldLevel}> "${ctx.text(el).slice(0, 60)}" to <h${newLevel}> ` +
      (demote ? 'so the page has a single main heading' : 'so the outline has no gaps') +
      (nested
        ? `, and re-levels the ${nested} heading${nested === 1 ? '' : 's'} under it (${changed.slice(1).join(', ')}).`
        : '.') +
      ' A class keeps the original size and spacing.',
    notes: ['Check that the new level matches the page structure you intend.'],
  });
}
