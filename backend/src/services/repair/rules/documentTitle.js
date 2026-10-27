import { PLACEHOLDER, patch } from '../context.js';
import { escapeText, headInsertPoint, insertBlock, replaceRange } from '../edits.js';

export const ruleIds = ['document-title'];

export function propose(_v, ctx) {
  const h1 = ctx.$('h1').first();
  const fromHeading = h1.length ? ctx.text(h1[0]).slice(0, 70) : '';
  const text = fromHeading || `${PLACEHOLDER} page title`;
  const strategy = fromHeading ? 'deterministic' : 'template';
  const explanation = fromHeading
    ? `Adds a <title> from the page's main heading: "${fromHeading}".`
    : 'Adds a <title>. Write a short, unique description of the page.';

  const existing = ctx.$('title')[0];
  if (existing?.sourceCodeLocation?.endTag) {
    const loc = existing.sourceCodeLocation;
    return patch({
      strategy,
      confidence: 'medium',
      edits: [replaceRange(loc.startTag.endOffset, loc.endTag.startOffset, escapeText(text))],
      explanation: explanation.replace('Adds a <title>', 'Fills the empty <title>'),
      placeholder: strategy === 'template' ? text : null,
    });
  }
  return patch({
    strategy,
    confidence: 'medium',
    edits: [insertBlock(ctx.source, headInsertPoint(ctx.$, ctx.source), `<title>${escapeText(text)}</title>`)],
    explanation,
    notes: ['Titles work best as "Page – Site name".'],
    placeholder: strategy === 'template' ? text : null,
  });
}
