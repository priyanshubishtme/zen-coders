import { manual, patch } from '../context.js';
import { setAttr } from '../edits.js';

export const ruleIds = ['duplicate-id', 'duplicate-id-aria', 'duplicate-id-active'];

const REF_ATTRS = ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant'];
const COMPONENT = 'form, fieldset, li, article, section, tr, dialog, figure';

/** Rename a later duplicate id and update references inside the same component. */
export function propose(v, ctx) {
  const { el, reason } = ctx.locate(v.node.target);
  if (!el) return manual(reason);
  const id = el.attribs.id;
  if (!id || !el.sourceCodeLocation) return manual('The duplicated id could not be found in the source.');

  const all = ctx.$('[id]').filter((_, n) => n.attribs.id === id).toArray();
  if (all[0] === el) {
    return manual(`This is the first element with id "${id}", so it keeps the id; the later copies are renamed instead.`);
  }

  const scripts = ctx.$('script:not([src])').text();
  if (scripts.includes(id)) {
    return manual(`Inline JavaScript mentions "${id}", so renaming it could break the page.`, [
      'Rename the duplicate and update the script that uses it.',
    ]);
  }

  const newId = ctx.uniqueId(`${id}-${all.indexOf(el) + 1}`);
  const edits = [setAttr(ctx.source, el, 'id', newId)];
  const component = ctx.$(el).closest(COMPONENT)[0] ?? el.parent;
  const inside = new Set(ctx.$(component).find('*').toArray());
  let updated = 0;
  let outside = 0;

  for (const node of ctx.$('*').toArray()) {
    if (!node.sourceCodeLocation || node === el) continue;
    for (const attr of [...REF_ATTRS, 'href']) {
      const value = node.attribs?.[attr];
      if (!value) continue;
      const refers = attr === 'href' ? value === `#${id}` : value.split(/\s+/).includes(id);
      if (!refers) continue;
      if (!inside.has(node)) {
        outside += 1;
        continue;
      }
      const next = attr === 'href' ? `#${newId}` : value.split(/\s+/).map((t) => (t === id ? newId : t)).join(' ');
      edits.push(setAttr(ctx.source, node, attr, next));
      updated += 1;
    }
  }

  return patch({
    strategy: 'deterministic',
    confidence: outside ? 'medium' : 'high',
    mark: el,
    edits,
    explanation:
      `Renames the duplicate id "${id}" to "${newId}"` +
      (updated ? ` and updates ${updated} reference${updated === 1 ? '' : 's'} in the same component.` : '.'),
    notes: outside
      ? [`${outside} reference${outside === 1 ? '' : 's'} outside this component still point to "${id}"; check which element they mean.`]
      : [],
  });
}
