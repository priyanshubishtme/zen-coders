import { z } from 'zod';
import { Id } from './common.js';
import { Repair } from './repair.js';
import { ScanInput, ScanOptions } from './scan.js';
import { ScanTokenSummary } from './tokenUsage.js';

/** Request and response bodies. Kept in sync with docs/04-api-contract.md. */

export const ScanIdParams = z.object({ id: Id });

export const CreateScanBody = z.object({
  input: ScanInput,
  options: ScanOptions,
});

export const CreateRepairsBody = z
  .object({
    /** Omit to repair every open violation. */
    violationIds: z.array(Id).max(500).optional(),
    /** false forces deterministic + template only, even when an LLM is configured. */
    useLlm: z.boolean().default(true),
  })
  .default({ useLlm: true });

export const CreateRepairsResponse = z.object({
  scanId: Id,
  repairs: z.array(Repair),
  tokenUsage: ScanTokenSummary,
});

/** Marks unfilled template text. A patch containing it is never applied or verified. */
export const PLACEHOLDER_MARKER = 'TODO:';

export const VerifyBody = z.object({
  repairIds: z.array(Id).min(1).max(500),
  /** User-edited patch text, e.g. reviewed alt text replacing a placeholder or AI draft. */
  edits: z
    .array(z.object({ repairId: Id, after: z.string().min(1).max(5000) }))
    .max(500)
    .optional(),
});

export const ReportQuery = z.object({
  format: z.enum(['json', 'md', 'html']).default('json'),
});

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSec: z.number().nonnegative(),
  checks: z.object({
    browser: z.enum(['up', 'down', 'unknown']),
    store: z.enum(['memory', 'mongo']),
    llm: z.enum(['off', 'on', 'circuit-open']),
  }),
});

export const UsageResponse = z.object({
  since: z.iso.datetime(),
  scans: z.number().int().nonnegative(),
  verifiedFixes: z.number().int().nonnegative(),
  tokens: ScanTokenSummary,
  rateLimiter: z.object({
    queued: z.number().int().nonnegative(),
    rpmRemaining: z.number().int().nonnegative(),
    tpmRemaining: z.number().int().nonnegative(),
  }),
});
