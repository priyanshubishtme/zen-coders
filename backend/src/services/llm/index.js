/**
 * LLM provider interface. The product must work with LLM_PROVIDER=none.
 * The LLM only drafts content (alt text, accessible names, plain wording);
 * it never detects violations. See docs/07-llm-cost-strategy.md.
 *
 * @typedef {object} LlmTask
 * @property {string} key          cache key (prompt version + model + rule + signature + context hash)
 * @property {'text' | 'vision'} tier
 * @property {string} ruleId
 * @property {object} input        size-capped, redacted context for the prompt
 *
 * @typedef {object} LlmResult
 * @property {string} key
 * @property {object | null} output   parsed structured JSON, or null on failure
 * @property {'ok' | 'cached' | 'over-budget' | 'rate-limited' | 'circuit-open' | 'error'} status
 *
 * @typedef {object} LlmProvider
 * @property {'none' | 'openai-compatible' | 'mock'} name
 * @property {boolean} enabled
 * @property {(tasks: LlmTask[], budget: { tokens: number }) => Promise<{
 *   results: LlmResult[], usage: object }>} completeBatch
 */

/** @returns {LlmProvider} */
export function createNoneProvider() {
  return {
    name: 'none',
    enabled: false,
    async completeBatch(tasks) {
      return {
        results: tasks.map((t) => ({ key: t.key, output: null, status: 'error' })),
        usage: emptyUsage('none'),
      };
    },
  };
}

export function emptyUsage(provider, model = null) {
  return {
    provider,
    model,
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheHits: 0,
    estimatedCostUsd: null,
  };
}

/** @param {{ LLM_PROVIDER: string }} config */
export function createLlmProvider(config) {
  switch (config.LLM_PROVIDER) {
    case 'none':
      return createNoneProvider();
    default:
      // openai-compatible and mock adapters arrive in Phase 3; degrade to off.
      return createNoneProvider();
  }
}
