import { z } from 'zod';
import { Id, Timestamp } from './common.js';
import { Score } from './score.js';
import { ScanTokenSummary } from './tokenUsage.js';
import { Violation } from './violation.js';

export const ScanInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('html'), html: z.string().min(1) }),
  /** Accepted by the schema now; served from Phase 2 (SSRF-hardened fetch). */
  z.object({ type: z.literal('url'), url: z.url({ protocol: /^https?$/ }) }),
]);

export const ScanOptions = z
  .object({
    includeAAA: z.boolean().default(false),
    includeBestPractice: z.boolean().default(true),
  })
  .default({ includeAAA: false, includeBestPractice: true });

export const Scan = z.object({
  id: Id,
  status: z.enum(['queued', 'scanning', 'completed', 'failed']),
  input: z.discriminatedUnion('type', [
    z.object({ type: z.literal('html'), bytes: z.number().int().nonnegative() }),
    z.object({ type: z.literal('url'), url: z.string() }),
  ]),
  options: ScanOptions,
  violations: z.array(Violation),
  manualReview: z.array(Violation),
  advisory: z.array(Violation),
  score: Score.nullable(),
  tokenUsage: ScanTokenSummary,
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});
