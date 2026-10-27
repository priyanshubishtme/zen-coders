import { NotImplementedError } from '../../utils/errors.js';

/**
 * Repair engine: turn each Violation into a Repair.
 * Order is fixed: deterministic rule fixer -> LLM (only for judgment calls,
 * within budget) -> template fallback -> manual-review label.
 * Rule fixers live in services/repair/rules/<ruleId>.js, one file per rule,
 * each with its own test. See docs/05-repair-catalog.md.
 *
 * @typedef {object} RuleFixer
 * @property {string} ruleId
 * @property {'deterministic' | 'llm-assisted' | 'manual'} strategy
 * @property {(violation: import('zod').infer<typeof import('../../schemas/violation.js').Violation>,
 *   html: string) => object | null} propose  returns a Patch, or null if it cannot fix this instance
 *
 * @typedef {object} RepairEngine
 * @property {(scan: object, opts: { violationIds?: string[], useLlm: boolean }) => Promise<object[]>} propose
 */

/** @returns {RepairEngine} */
export function createRepairEngine() {
  return {
    async propose() {
      throw new NotImplementedError('RepairEngine.propose');
    },
  };
}
