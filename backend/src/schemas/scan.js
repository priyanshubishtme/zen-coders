import { z } from 'zod';
import { Id, Timestamp } from './common.js';
import { Score } from './score.js';
import { ScanTokenSummary } from './tokenUsage.js';
import { Violation } from './violation.js';

const count = z.number().int().nonnegative();
const ms = z.number().int().nonnegative();

export const ScanInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('html'), html: z.string().min(1) }),
  z.object({ type: z.literal('url'), url: z.url({ protocol: /^https?$/ }).max(2048) }),
]);

export const ScanOptions = z
  .object({
    includeAAA: z.boolean().default(false),
    includeBestPractice: z.boolean().default(true),
    /** Same-host breadth-first crawl. Requires a signed-in user. */
    crawl: z.boolean().default(false),
    /** Optional CSS selector. A miss is a warning, not a failed scan. */
    waitFor: z.string().trim().min(1).max(200).optional(),
    /** Tab walk. Off only when the client sends false. Never affects the axe score. */
    keyboard: z.boolean().default(true),
  })
  .default({ includeAAA: false, includeBestPractice: true, crawl: false, keyboard: true });

export const LogStage = z.enum([
  'render',
  'wait',
  'axe',
  'patch',
  'verify',
  'score',
  'screenshot',
  'crawl',
  'failed',
]);

export const ScanEvent = z.object({
  id: z.string().min(1).max(32),
  at: Timestamp,
  stage: LogStage,
  message: z.string().max(500),
  ms: z.number().int().nonnegative().nullable(),
});

export const Mark = z.object({
  violationId: Id,
  n: z.number().int().positive().nullable(),
  x: z.number().min(0).max(1).nullable(),
  y: z.number().min(0).max(1).nullable(),
  w: z.number().min(0).max(1).nullable(),
  h: z.number().min(0).max(1).nullable(),
  name: z.string().max(200),
  role: z.string().max(40),
  place: z.enum(['pin', 'offscreen', 'frame', 'unmeasured']),
});

export const ScanStage = z.enum([
  'queued',
  'loading',
  'rendering',
  'checking',
  'normalizing',
  'done',
  'failed',
]);

export const HeadingOutlineItem = z.object({
  level: z.number().int().min(1).max(9),
  text: z.string(),
  target: z.array(z.string()),
  /** Computed look, so a heading-level fix can keep it. */
  style: z
    .object({
      fontSize: z.string(),
      fontWeight: z.string(),
      marginTop: z.string(),
      marginBottom: z.string(),
    })
    .nullable()
    .optional(),
});

export const Scan = z.object({
  id: Id,
  status: z.enum(['queued', 'scanning', 'completed', 'failed']),
  stage: ScanStage,
  input: z.discriminatedUnion('type', [
    z.object({ type: z.literal('html'), bytes: count }),
    z.object({ type: z.literal('url'), url: z.string() }),
  ]),
  /** sha256 of the input (type + content). Raw HTML is not stored or echoed. */
  inputHash: z.string().length(64),
  options: ScanOptions,
  violations: z.array(Violation),
  manualReview: z.array(Violation),
  advisory: z.array(Violation),
  headingOutline: z.array(HeadingOutlineItem),
  page: z
    .object({
      finalUrl: z.string().nullable(),
      title: z.string().nullable(),
      /** false when the network never went quiet before the cap. */
      settled: z.boolean(),
    })
    .nullable(),
  network: z
    .object({
      requests: count,
      blocked: count,
      blockedSamples: z.array(z.object({ url: z.string(), reason: z.string() })),
    })
    .nullable(),
  engine: z.object({ axeVersion: z.string() }).nullable(),
  timings: z.object({
    queueMs: ms.nullable(),
    loadMs: ms.nullable(),
    renderMs: ms.nullable(),
    axeMs: ms.nullable(),
    checksMs: ms.nullable(),
    normalizeMs: ms.nullable(),
    totalMs: ms.nullable(),
  }),
  /** Formula version 1; null only when no in-scope rule applied (shown as N/A). */
  score: Score.nullable(),
  /** Engine log. Empty until the scan publishes a stage. */
  events: z.array(ScanEvent).default([]),
  /** Pins are fractions of the viewport. Off-screen nodes have n and x null. */
  marks: z.array(Mark).default([]),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).nullable(),
  shots: z.object({ before: z.boolean(), after: z.boolean() }).default({ before: false, after: false }),
  /** Null on scans created while signed out. Those stay capability links. */
  ownerId: z.string().nullable().default(null),
  access: z.enum(['capability', 'private']).default('capability'),
  authUsed: z.boolean().default(false),
  pinnedHost: z.string().nullable().default(null),
  partial: z.boolean().default(false),
  renderWarning: z.string().nullable().default(null),
  pages: z
    .array(
      z.object({
        url: z.string(),
        depth: z.number().int().nonnegative(),
        status: z.enum(['completed', 'skipped', 'failed']),
        reason: z.string().nullable(),
      }).passthrough(),
    )
    .default([]),
  keyboard: z
    .array(
      z.object({
        id: z.string(),
        confidence: z.enum(['high', 'medium', 'low']),
        message: z.string(),
      }).passthrough(),
    )
    .default([]),
  tokenUsage: ScanTokenSummary,
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
});

/** 202 body for POST /scans. */
export const ScanAccepted = Scan.pick({ id: true, status: true, stage: true });
