import { z } from 'zod';
import { Id, Timestamp } from './common.js';
import { Score } from './score.js';
import { Violation } from './violation.js';

export const RepairOutcome = z.object({
  repairId: Id,
  outcome: z.enum(['resolved', 'still-failing', 'regressed', 'not-applied']),
  detail: z.string().nullable(),
});

/**
 * Result of applying repairs to an isolated copy and re-running axe.
 * A repair is "verified" only if its violation is gone and no new
 * violation appeared anywhere on the page.
 */
export const VerificationResult = z.object({
  id: Id,
  scanId: Id,
  status: z.enum(['verified', 'partial', 'failed']),
  repairs: z.array(RepairOutcome),
  regressions: z.array(Violation),
  before: Score,
  after: Score,
  patchedHtml: z.string(),
  durationMs: z.number().int().nonnegative(),
  verifiedAt: Timestamp,
});
