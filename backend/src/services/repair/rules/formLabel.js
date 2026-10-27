import { PLACEHOLDER, humanize, manual, patch } from '../context.js';
import { appendInside, escapeAttr, escapeText, insertAt, insertBefore, prependInside, setAttr } from '../edits.js';

export const ruleIds = ['label', 'select-name'];

const CONTROLS = new Set(['input', 'select', 'textarea']);
const TEXT_CONTAINERS = new Set(['span', 'strong', 'b', 'em', 'p', 'div', 'small']);
const TYPE_NAMES = { search: 'Search', email: 'Email', tel: 'Phone', url: 'Website', password: 'Password' };

/** The visible text right before the control, if it plausibly labels it. */
function adjacentText(ctx, el) {
  let prev = el.prev;
  while (prev && prev.type === 'text' && !prev.data.trim()) prev = prev.prev;
  if (!prev) return null;
  if (prev.type === 'text' && prev.sourceCodeLocation) {
    const raw = prev.data;
    const text = raw.trim();
    if (!text || text.length > 60) return null;
    const lead = raw.length - raw.trimStart().length;
    const start = prev.sourceCodeLocation.startOffset + lead;
    const srcText = ctx.source.slice(start, start + text.length);
    if (srcText !== text) return null; // entities in the source: offsets would not line up
    return { kind: 'text', text, start, end: start + text.length };
  }
  if (
    prev.type === 'tag' &&
    TEXT_CONTAINERS.has(prev.tagName) &&
    prev.sourceCodeLocation?.endTag &&
    !ctx.$(prev).find('input,select,textarea,button,a,label').length
  ) {
    const text = ctx.text(prev);
    if (text && text.length <= 60) return { kind: 'element', text, el: prev };
  }
  return null;
}

/** Native <label for> first: wrap existing text, else add a visible label. ARIA is never used. */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  if (!el.sourceCodeLocation || !CONTROLS.has(el.tagName)) {
    return manual('This is not a native form field, so it needs a label in the component that renders it.');
  }

  const edits = [];
  let id = el.attribs.id;
  if (!id) {
    id = ctx.uniqueId(el.attribs.name || el.attribs.type || 'field');
    edits.push(setAttr(ctx.source, el, 'id', id));
  }
  const open = `<label for="${escapeAttr(id)}" data-accessfix>`;

  const near = adjacentText(ctx, el);
  if (near?.kind === 'text') {
    edits.push(insertAt(near.start, open), insertAt(near.end, '</label>'));
    return patch({
      strategy: 'deterministic',
      confidence: 'high',
      mark: el,
      edits,
      explanation: `Turns the text "${near.text}" next to the field into its <label>.`,
    });
  }
  if (near?.kind === 'element') {
    edits.push(prependInside(near.el, open), appendInside(near.el, '</label>'));
    return patch({
      strategy: 'deterministic',
      confidence: 'high',
      mark: el,
      edits,
      explanation: `Makes the text "${near.text}" next to the field its <label>.`,
    });
  }

  const derived =
    el.attribs.placeholder?.trim() || humanize(el.attribs.name) || TYPE_NAMES[el.attribs.type] || '';
  const text = derived || `${PLACEHOLDER} label this field`;
  edits.push(insertBefore(el, `${open}${escapeText(text)}</label> `));
  return patch({
    strategy: derived ? 'deterministic' : 'template',
    confidence: derived ? 'medium' : 'low',
    mark: el,
    edits,
    explanation: derived
      ? `Adds a visible <label>"${text}"</label> for the field, taken from its ${el.attribs.placeholder ? 'placeholder' : 'name'}.`
      : 'Adds a visible <label> for the field. Write what the field is for.',
    notes: ['Adds visible text, so the layout may shift slightly.'],
    placeholder: derived ? null : text,
  });
}
