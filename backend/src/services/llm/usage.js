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

export function emptyTokenSummary(budget, provider = 'none') {
  return {
    ...emptyUsage(provider),
    budget,
    budgetExhausted: false,
    deterministicFixes: 0,
    dedupedItems: 0,
    naiveEstimateTokens: 0,
    tokensSaved: 0,
    tokensPerVerifiedFix: null,
  };
}
