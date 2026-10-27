import { z } from 'zod';
import { Id, Impact, WcagLevel } from './common.js';

export const WcagRef = z.object({
  sc: z.string().regex(/^\d\.\d+\.\d+$/),
  name: z.string(),
  level: WcagLevel.nullable(),
  url: z.url(),
});

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
    refs: z.array(WcagRef),
  }),
  title: z.string(),
  explanation: z.string(),
  whoItAffects: z.string(),
  helpUrl: z.url().nullable(),
  node: z.object({
    /** One selector per frame; shadow-DOM hops joined with " >>> ". */
    target: z.array(z.string().min(1)).min(1),
    html: z.string().max(2000),
    failureSummary: z.string().nullable(),
  }),
  /** ruleId + hash of the normalized element pattern; used for dedupe and LLM caching. */
  signature: z.string(),
  status: z.enum(['open', 'fix-proposed', 'fixed-verified', 'fix-failed', 'manual-review']),
});
