import { NotImplementedError } from '../../utils/errors.js';

/**
 * Verifier: apply selected repairs to a copy of the original HTML, re-scan
 * with the same options, and diff violations by (ruleId, target).
 * A repair is "verified" only if its violation disappeared AND no new
 * violation appeared anywhere. The original input is never mutated.
 *
 * @typedef {object} Verifier
 * @property {(scan: object, repairs: object[]) => Promise<object>} verify  returns a VerificationResult
 */

/** @returns {Verifier} */
export function createVerifier() {
  return {
    async verify() {
      throw new NotImplementedError('Verifier.verify');
    },
  };
}
