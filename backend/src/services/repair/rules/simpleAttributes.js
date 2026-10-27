import { manual, patch } from '../context.js';
import { setAttr } from '../edits.js';

export const ruleIds = ['meta-viewport', 'tabindex'];

/** Small, unambiguous attribute fixes. */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation) return manual('The element has no tag of its own in the source.');

  if (v.ruleId === 'tabindex') {
    return patch({
      strategy: 'deterministic',
      confidence: 'high',
      mark: el,
      edits: [setAttr(ctx.source, el, 'tabindex', '0')],
      explanation: `Changes tabindex="${el.attribs.tabindex}" to "0" so keyboard focus follows the page order.`,
    });
  }

  const parts = (el.attribs.content ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^user-scalable\s*=\s*(no|0)$/i.test(p))
    .map((p) => {
      const m = /^maximum-scale\s*=\s*([\d.]+)$/i.exec(p);
      return m && Number(m[1]) < 5 ? 'maximum-scale=5' : p;
    });
  return patch({
    strategy: 'deterministic',
    confidence: 'high',
    mark: el,
    edits: [setAttr(ctx.source, el, 'content', parts.join(', '))],
    explanation: 'Allows pinch-zoom again: removes user-scalable=no and lets people zoom to at least 500%.',
  });
}
