import { z } from 'zod';

export const Impact = z.enum(['critical', 'serious', 'moderate', 'minor']);

/** Impact weights used by the scorer. See docs/06-scoring-spec.md. */
export const IMPACT_WEIGHTS = Object.freeze({ critical: 10, serious: 7, moderate: 3, minor: 1 });

export const WcagLevel = z.enum(['A', 'AA', 'AAA']);

export const Confidence = z.enum(['high', 'medium', 'low']);

export const Id = z.string().min(1).max(64);

export const Timestamp = z.iso.datetime();

/** axe-style target: one selector per frame/shadow boundary. */
export const Selector = z.array(z.string().min(1)).min(1);

export const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
