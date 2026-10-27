import { PLACEHOLDER, manual, patch } from '../context.js';
import { setAttr } from '../edits.js';

export const ruleIds = ['image-alt', 'input-image-alt'];

const SPACER = /(spacer|blank|pixel|transparent|divider|shim|1x1|clear)\.(gif|png|svg|webp)$/i;

/** Evidence the image adds nothing for screen reader users. */
function decorativeEvidence(ctx, el) {
  const w = Number.parseInt(el.attribs.width ?? '', 10);
  const h = Number.parseInt(el.attribs.height ?? '', 10);
  if (w > 0 && h > 0 && w <= 2 && h <= 2) return 'it is at most 2×2 pixels';
  const file = (el.attribs.src ?? '').split(/[?#]/)[0];
  if (SPACER.test(file)) return `its file name "${file.split('/').pop()}" marks it as a spacer`;
  const owner = ctx.$(el).closest('a,button')[0];
  if (owner) {
    const clone = ctx.$(owner).clone();
    clone.find('img').remove();
    if (clone.text().trim()) return 'the link or button around it already has text';
  }
  return null;
}

/** Decorative images get alt=""; informative ones need words a person must write. */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation) return manual('The image has no tag of its own in the source.');

  const isInputImage = el.tagName === 'input';
  if (!isInputImage) {
    const why = decorativeEvidence(ctx, el);
    if (why) {
      return patch({
        strategy: 'deterministic',
        confidence: 'high',
        mark: el,
        edits: [setAttr(ctx.source, el, 'alt', '')],
        explanation: `Marks the image as decorative with alt="" because ${why}. Screen readers will skip it.`,
      });
    }
  }

  const title = el.attribs.title?.trim();
  if (title) {
    return patch({
      strategy: 'deterministic',
      confidence: 'medium',
      mark: el,
      edits: [setAttr(ctx.source, el, 'alt', title)],
      explanation: `Uses the image's title "${title}" as its alt text.`,
      notes: ['Check that the title really describes the image.'],
    });
  }

  const text = isInputImage ? `${PLACEHOLDER} say what this button does` : `${PLACEHOLDER} describe this image`;
  return patch({
    strategy: 'template',
    confidence: 'low',
    mark: el,
    edits: [setAttr(ctx.source, el, 'alt', text)],
    explanation: isInputImage
      ? 'Adds alt text to the image button. Write what the button does, for example "Search".'
      : 'Adds alt text. Write what the image shows and why it matters here, or use an empty alt if it is purely decorative.',
    placeholder: text,
  });
}
