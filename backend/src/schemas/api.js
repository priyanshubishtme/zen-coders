import { z } from 'zod';
import { Id } from './common.js';
import { Repair } from './repair.js';
import { ScanInput, ScanOptions } from './scan.js';
import { ScanTokenSummary } from './tokenUsage.js';

/** Request and response bodies. Kept in sync with docs/04-api-contract.md. */

export const ScanIdParams = z.object({ id: Id });

/** Capability list: only the IDs the client already has. Cap 50. */
export const ListScansQuery = z.object({
  ids: z
    .string()
    .min(1)
    .max(4000)
    .transform((raw) => raw.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(Id).min(1).max(50)),
});

export const AuthBody = z
  .object({
    storageState: z.record(z.string(), z.unknown()).optional(),
    cookies: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          value: z.string().min(1).max(4096),
          domain: z.string().max(253).optional(),
          path: z.string().max(200).optional(),
        }),
      )
      .max(50)
      .optional(),
  })
  .refine((value) => value.storageState || value.cookies?.length, {
    message: 'Provide storageState or cookies.',
  });

export const CreateScanBody = z.object({
  input: ScanInput,
  options: ScanOptions,
  auth: AuthBody.optional(),
});

export const SignupBody = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email.'),
  password: z.string().min(10).max(200),
});

export const ShareBody = z
  .object({
    expiresAt: z.iso.datetime().optional(),
  })
  .default({});

export const ShareParams = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/),
});

export const CreateRepairsBody = z
  .object({
    /** Omit to repair every open violation. */
    violationIds: z.array(Id).max(500).optional(),
    /** false forces deterministic + template only, even when an LLM is configured. */
    useLlm: z.boolean().default(true),
  })
  .default({ useLlm: true });

const count = z.number().int().nonnegative();

export const CreateRepairsResponse = z.object({
  scanId: Id,
  /** One per violation and advisory item, each already verified by an offline re-scan. */
  repairs: z.array(Repair),
  summary: z.object({
    verified: count,
    failed: count,
    regressed: count,
    notApplied: count,
    needsInput: count,
    manual: count,
    scansRun: count,
  }),
  tokenUsage: ScanTokenSummary,
});

/** Marks unfilled template text. A patch containing it is never applied or verified. */
export const PLACEHOLDER_MARKER = 'TODO:';

export const VerifyBody = z.object({
  repairIds: z.array(Id).min(1).max(500),
  /** Text that replaces a template repair's placeholder (e.g. reviewed alt text). */
  edits: z
    .array(z.object({ repairId: Id, text: z.string().trim().min(1).max(500) }))
    .max(500)
    .optional(),
  /** LLM drafts are applied only when listed here. */
  acceptedRepairIds: z.array(Id).max(500).optional(),
  /** Restore these LLM drafts to their TODO: templates. */
  rejectedRepairIds: z.array(Id).max(500).optional(),
});

export const ReportQuery = z.object({
  format: z.enum(['json', 'md', 'html']).default('json'),
});

/** Which stored JPEG to return. Not a file path. */
export const ScreenshotQuery = z.object({
  which: z.enum(['before', 'after']).default('before'),
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
  quotas: z.enum(['on', 'off']),
  tokenCeiling: z.enum(['ok', 'reached']),
  authenticatedScanning: z.enum(['on', 'disabled: no key']),
  limits: z.object({
    maxHtmlBytes: z.number().int().positive(),
    /** true only in dev/test; the UI shows a warning badge. */
    privateUrlsAllowed: z.boolean(),
  }),
  plans: z
    .object({
      loggedOutScansDay: z.number().int().nonnegative(),
      free: z.object({
        scansDay: z.number().int(),
        pagesDay: z.number().int(),
        tokensDay: z.number().int(),
        crawlPages: z.number().int(),
      }),
      pro: z.object({
        scansDay: z.number().int(),
        pagesDay: z.number().int(),
        tokensDay: z.number().int(),
        crawlPages: z.number().int(),
      }),
    })
    .optional(),
  crawl: z
    .object({
      maxPages: z.number().int(),
      maxDepth: z.number().int(),
      budgetMs: z.number().int(),
      gapMs: z.number().int(),
      zipMaxBytes: z.number().int(),
    })
    .optional(),
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
