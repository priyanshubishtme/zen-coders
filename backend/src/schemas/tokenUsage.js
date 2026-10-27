import { z } from 'zod';

const count = z.number().int().nonnegative();

/** Token accounting for one LLM call, one repair, or one whole scan. */
export const TokenUsage = z.object({
  provider: z.enum(['none', 'openai-compatible', 'mock']),
  model: z.string().nullable(),
  calls: count,
  promptTokens: count,
  completionTokens: count,
  totalTokens: count,
  cacheHits: count,
  /** null when no price is configured. */
  estimatedCostUsd: z.number().nonnegative().nullable(),
});

/** Scan-level rollup, including what we avoided spending. */
export const ScanTokenSummary = TokenUsage.extend({
  budget: count,
  budgetExhausted: z.boolean(),
  deterministicFixes: count,
  dedupedItems: count,
  /** Tokens a one-call-per-violation approach would have used. */
  naiveEstimateTokens: count,
  tokensSaved: count,
  /** null until at least one fix is verified. */
  tokensPerVerifiedFix: z.number().nonnegative().nullable(),
});
