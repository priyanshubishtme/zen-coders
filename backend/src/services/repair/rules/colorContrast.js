import { contrast, fixContrast, parseHex } from '../color.js';
import { manual, patch } from '../context.js';
import { colorDeclarations, cssColorToHex, setStyleProp } from '../css.js';
import { replaceRange, setAttr } from '../edits.js';

export const ruleIds = ['color-contrast'];

/** Aim a hair above the threshold so 8-bit rounding can never land below it. */
const MARGIN = 0.02;

/**
 * Darken or lighten the text colour (hue kept) just enough to pass.
 * Where the colour comes from one page <style> rule, edit that rule; otherwise
 * set an inline colour on the element.
 */
export function propose(v, ctx) {
  const ev = v.node.evidence;
  if (!ev?.fgColor || !ev?.bgColor || !ev?.expectedContrastRatio) {
    return manual('The colours could not be measured (for example text over an image or gradient).', [
      'Check the contrast with a colour picker against the darkest and lightest parts of the background.',
    ]);
  }
  if (!parseHex(ev.fgColor) || !parseHex(ev.bgColor)) {
    return manual('The text or background colour is semi-transparent, so the real contrast depends on what is behind it.', [
      'Make the colours opaque, or check contrast against everything that can appear behind the text.',
    ]);
  }
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation) return manual('The element has no tag of its own in the source.');

  const required = parseFloat(ev.expectedContrastRatio);
  const fix = fixContrast(ev.fgColor, ev.bgColor, required + MARGIN);
  if (!fix) return manual('No text colour reaches the required contrast on this background.');

  const before = contrast(parseHex(ev.fgColor), parseHex(ev.bgColor));
  const fg = ev.fgColor.toLowerCase();
  const summary = `Changes the text colour from ${fg} to ${fix.hex} (same hue). Contrast goes from ${before.toFixed(2)}:1 to ${fix.ratio.toFixed(2)}:1; it needs ${required}:1.`;

  const inline = el.attribs.style ?? '';
  if (/(^|;)\s*color\s*:/i.test(inline)) {
    return patch({
      strategy: 'deterministic',
      confidence: 'high',
      mark: el,
      edits: [setAttr(ctx.source, el, 'style', setStyleProp(inline, 'color', fix.hex))],
      explanation: `${summary} Edits the element's inline style.`,
    });
  }

  const owning = colorDeclarations(ctx.$, ctx.source).filter((d) => {
    if (cssColorToHex(d.value) !== fg) return false;
    try {
      return ctx.$(el).is(d.selector);
    } catch {
      return false;
    }
  });
  if (owning.length === 1) {
    const d = owning[0];
    return patch({
      strategy: 'deterministic',
      confidence: 'high',
      mark: el,
      edits: [replaceRange(d.start, d.end, fix.hex)],
      explanation: `${summary} Edits the "${d.selector}" rule, so every element using it is fixed at once.`,
      notes: ['Other elements that use this rule change colour too.'],
    });
  }

  return patch({
    strategy: 'deterministic',
    confidence: 'medium',
    mark: el,
    edits: [setAttr(ctx.source, el, 'style', setStyleProp(inline, 'color', fix.hex))],
    explanation: `${summary} Adds an inline colour because the original colour does not come from a single rule in this page.`,
    notes: ['Consider moving this colour into your stylesheet.'],
  });
}
