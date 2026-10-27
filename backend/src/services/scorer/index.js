import { NotImplementedError } from '../../utils/errors.js';

/**
 * Scorer: pure function from raw axe results to a Score.
 * score = 100 * (1 - sum(w_r * fail_r) / sum(w_r * (pass_r + fail_r)))
 * over in-scope WCAG rules; w_r is the fixed per-rule weight from the repair
 * catalog (critical 10, serious 7, moderate 3, minor 1; default 3).
 * Needs-review and best-practice results never affect the value.
 * See docs/06-scoring-spec.md.
 *
 * @param {import('../scanner/index.js').RawScanResult} _raw
 * @returns {object} Score
 */
export function computeScore(_raw) {
  throw new NotImplementedError('computeScore');
}
