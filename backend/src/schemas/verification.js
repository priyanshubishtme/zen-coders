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
 * Result of applying repairs to an isolated copy and re-scanning it offline.
 * A repair is "verified" only if its violation is gone and it introduced no
 * new violation anywhere on the page.
 */
export const VerificationResult = z.object({
  id: Id,
  scanId: Id,
  status: z.enum(['verified', 'partial', 'failed']),
  repairs: z.array(RepairOutcome),
  /** WCAG and advisory items present before and gone after. */
  resolved: z.array(Violation),
  /** Items still present after. */
  remaining: z.array(Violation),
  /** Items that were not there before: always shown, never hidden. */
  regressions: z.array(Violation),
  manualReview: z.array(Violation),
  before: Score,
  after: Score,
  /** Patched source with only the verified fixes applied. */
  patchedHtml: z.string(),
  scansRun: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  verifiedAt: Timestamp,
});
