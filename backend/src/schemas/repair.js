import { z } from 'zod';
import { Confidence, Id, Selector, Timestamp } from './common.js';
import { TokenUsage } from './tokenUsage.js';

export const Patch = z.object({
  kind: z.enum(['attribute', 'element', 'css', 'document']),
  target: Selector,
  /** Only the changed source lines, before and after. */
  before: z.string(),
  after: z.string(),
  /** Unified diff against the original source, 2 lines of context. */
  diff: z.string(),
  /** "Copy fix" payload: one-line explanation + diff. */
  copy: z.string(),
});

export const RepairStatus = z.enum([
  'proposed',
  'verified',
  'failed',
  'regressed',
  'not-applied',
  'needs-input',
  'manual-review',
]);

/** A fix for one violation. Fix-first: every violation ends in exactly one Repair. */
export const Repair = z.object({
  id: Id,
  violationId: Id,
  ruleId: z.string(),
  /** template = structurally right but needs human words (TODO: placeholder). */
  strategy: z.enum(['deterministic', 'llm', 'template', 'manual']),
  status: RepairStatus,
  confidence: Confidence,
  /** null only for strategy "manual". */
  patch: Patch.nullable(),
  rationale: z.string(),
  /** Warnings and, for manual repairs, what to check. */
  notes: z.array(z.string()),
  needsHumanInput: z.boolean(),
  /** The placeholder text to replace via VerifyBody.edits; null when none. */
  placeholder: z.string().nullable(),
  /** LLM-drafted (or user-edited) words; null for templates still showing TODO:. */
  draft: z.string().nullable().optional(),
  /** LLM drafts stay false until the user explicitly accepts them. */
  accepted: z.boolean().optional().default(false),
  tokenUsage: TokenUsage.nullable(),
  /** Result of the last re-scan that included this repair. */
  verification: z
    .object({
      outcome: z.enum(['resolved', 'still-failing', 'regressed', 'not-applied']),
      detail: z.string().nullable(),
    })
    .nullable(),
  createdAt: Timestamp,
});
