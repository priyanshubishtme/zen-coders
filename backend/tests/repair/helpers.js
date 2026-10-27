import { createContext } from '../../src/services/repair/context.js';
import { applyEdits, cssBlockEdit } from '../../src/services/repair/edits.js';

export const scanStub = (extra = {}) => ({
  id: 's_test',
  violations: [],
  advisory: [],
  headingOutline: [],
  ...extra,
});

export const violation = (ruleId, target, extra = {}) => ({
  id: `v_${ruleId}`,
  ruleId,
  ...extra,
  node: { target: Array.isArray(target) ? target : [target], html: '', evidence: null, ...extra.node },
});

/** Run one fixer against `source` and return its proposal plus the patched text. */
export function run(fixer, source, v, scan = scanStub()) {
  const ctx = createContext({ source, scan });
  const p = fixer.propose(v, ctx);
  if (p.kind !== 'patch') return { p, after: source, ctx };
  const edits = p.edits.filter(Boolean);
  const after = applyEdits(source, [...edits, ...cssBlockEdit(ctx.$, source, p.css)]);
  return { p, after, ctx };
}
