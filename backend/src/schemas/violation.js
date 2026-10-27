import { z } from 'zod';
import { Id, Impact, Selector, WcagLevel } from './common.js';

/**
 * One failing (or needs-review) element for one rule. Detection only ever
 * comes from axe-core or our deterministic checks, never from the LLM.
 */
export const Violation = z.object({
  id: Id,
  ruleId: z.string().min(1),
  source: z.enum(['axe', 'accessfix']),
  outcome: z.enum(['violation', 'needs-review']),
  /** wcag rules count toward the score; best-practice rules are advisory. */
  category: z.enum(['wcag', 'best-practice']),
  impact: Impact,
  wcag: z.object({
    criteria: z.array(z.string().regex(/^\d\.\d+\.\d+$/)),
    level: WcagLevel.nullable(),
  }),
  title: z.string(),
  explanation: z.string(),
  helpUrl: z.url().nullable(),
  node: z.object({
    target: Selector,
    html: z.string().max(2000),
    failureSummary: z.string().nullable(),
  }),
  /** Hash of ruleId + normalized node pattern; used for dedupe and LLM caching. */
  signature: z.string(),
  status: z.enum(['open', 'fix-proposed', 'fixed-verified', 'fix-failed', 'manual-review']),
});
