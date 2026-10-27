import { z } from 'zod';

const count = z.number().int().nonnegative();
const bucket = z.object({ fail: count, pass: count });

/** See docs/06-scoring-spec.md for the formula. */
export const Score = z.object({
  /** 0-100, or null when no in-scope rule applied (rendered "N/A"). */
  value: z.number().int().min(0).max(100).nullable(),
  formulaVersion: z.literal(1),
  standard: z.string(),
  rulesChecked: count,
  elementsChecked: count,
  failingElements: count,
  weightedFailures: count,
  weightedTotal: count,
  byImpact: z.object({ critical: bucket, serious: bucket, moderate: bucket, minor: bucket }),
  /** Kept out of the score on purpose. */
  manualReviewCount: count,
  advisoryCount: count,
  engine: z.object({ axeVersion: z.string() }),
});
