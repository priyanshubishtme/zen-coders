import { z } from 'zod';
import { Confidence, Id, Selector, Timestamp } from './common.js';
import { TokenUsage } from './tokenUsage.js';

export const Patch = z.object({
  kind: z.enum(['attribute', 'element', 'css', 'document']),
  target: Selector,
  before: z.string(),
  after: z.string(),
  /** Unified diff of before -> after, ready to copy. */
  diff: z.string(),
});

/** A proposed fix for one violation. Fix-first: every violation ends in a Repair. */
export const Repair = z.object({
  id: Id,
  violationId: Id,
  ruleId: z.string(),
  /** template = LLM was wanted but unavailable/over budget; manual = no safe automated fix. */
  strategy: z.enum(['deterministic', 'llm', 'template', 'manual']),
  status: z.enum(['proposed', 'verified', 'failed', 'manual-review']),
  confidence: Confidence,
  /** null only for strategy "manual". */
  patch: Patch.nullable(),
  rationale: z.string(),
  /** True when the patch contains a placeholder a human must fill in (e.g. alt text draft). */
  needsHumanInput: z.boolean(),
  tokenUsage: TokenUsage.nullable(),
  createdAt: Timestamp,
});
