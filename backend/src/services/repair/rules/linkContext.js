import { SR_ONLY_CSS, manual, patch } from '../context.js';
import { appendInside, escapeText } from '../edits.js';

export const ruleIds = ['afx-link-ambiguous'];

/** The nearest heading before `el` in document order. */
function nearestHeading(ctx, el) {
  const all = ctx.$('h1,h2,h3,h4,h5,h6,a').toArray();
  for (let i = all.indexOf(el) - 1; i >= 0; i -= 1) {
    if (/^h[1-6]$/.test(all[i].tagName)) return all[i];
  }
  return null;
}

/**
 * "Read more" -> "Read more<span class=afx-sr-only> about Sourdough</span>":
 * the visible text stays, screen readers hear the full purpose (WCAG technique C7).
 */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation?.endTag) return manual('The link has no closing tag to add text inside.');
  const heading = nearestHeading(ctx, el);
  const topic = heading ? ctx.text(heading).slice(0, 80) : '';
  if (!topic) {
    return manual('There is no nearby heading to take context from.', [
      'Rewrite the link text so it says where it goes, for example "Read the sourdough recipe".',
    ]);
  }
  return patch({
    strategy: 'deterministic',
    confidence: 'medium',
    mark: el,
    edits: [appendInside(el, `<span class="afx-sr-only" data-accessfix> about ${escapeText(topic)}</span>`)],
    css: [SR_ONLY_CSS],
    explanation: `Adds hidden context so screen readers hear "${ctx.text(el)} about ${topic}" while the visible text stays the same.`,
    notes: ['Better still: make the visible link text say where it goes.'],
  });
}
