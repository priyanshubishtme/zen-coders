import { isWcagRule, wcagFromTags } from '../scanner/normalize.js';
import { impactOf, weightOf } from './weights.js';

export const FORMULA_VERSION = 1;

/** Round half up; never show 100 while anything still fails (doc 06, rule 2). */
function toScore(failures, total) {
  if (total === 0) return null;
  const raw = 100 * (1 - failures / total);
  const rounded = Math.floor(raw + 0.5);
  return failures > 0 && rounded >= 100 ? 99 : rounded;
}

/**
 * docs/06-scoring-spec.md, formula version 1:
 *   score = round(100 * (1 - Σ w·fail / Σ w·(pass + fail)))
 * over in-scope WCAG rules that applied to the page. Best-practice rules,
 * our own advisory checks and axe "incomplete" results never count.
 *
 * @param {{ axeVersion: string, violations: object[], passes: { id: string, tags: string[], count: number }[],
 *   incomplete: object[], findings?: object[] }} raw
 * @param {{ includeAAA?: boolean }} [options]
 */
export function computeScore(raw, { includeAAA = false } = {}) {
  const rules = new Map();
  const add = (id, tags, key, n) => {
    if (!isWcagRule(tags)) return;
    const r = rules.get(id) ?? {
      ruleId: id,
      impact: impactOf(id),
      weight: weightOf(id),
      pass: 0,
      fail: 0,
      wcag: wcagFromTags(tags),
    };
    r[key] += n;
    rules.set(id, r);
  };
  for (const r of raw.violations) add(r.id, r.tags, 'fail', r.nodes.length);
  for (const r of raw.passes ?? []) add(r.id, r.tags, 'pass', r.count);

  const list = [...rules.values()]
    .filter((r) => r.pass + r.fail > 0)
    .sort((a, b) => b.weight * b.fail - a.weight * a.fail || a.ruleId.localeCompare(b.ruleId));

  const byImpact = Object.fromEntries(
    ['critical', 'serious', 'moderate', 'minor'].map((k) => [k, { fail: 0, pass: 0 }]),
  );
  let weightedFailures = 0;
  let weightedTotal = 0;
  for (const r of list) {
    weightedFailures += r.weight * r.fail;
    weightedTotal += r.weight * (r.pass + r.fail);
    byImpact[r.impact].fail += r.fail;
    byImpact[r.impact].pass += r.pass;
  }

  const advisory =
    raw.violations.filter((r) => !isWcagRule(r.tags)).reduce((n, r) => n + r.nodes.length, 0) +
    (raw.findings?.length ?? 0);

  return {
    value: toScore(weightedFailures, weightedTotal),
    formulaVersion: FORMULA_VERSION,
    standard: includeAAA ? 'WCAG 2.2 AAA' : 'WCAG 2.2 AA',
    rulesChecked: list.length,
    elementsChecked: list.reduce((n, r) => n + r.pass + r.fail, 0),
    failingElements: list.reduce((n, r) => n + r.fail, 0),
    weightedFailures,
    weightedTotal,
    byImpact,
    rules: list,
    manualReviewCount: raw.incomplete.reduce((n, r) => n + r.nodes.length, 0),
    advisoryCount: advisory,
    engine: { axeVersion: raw.axeVersion },
  };
}
