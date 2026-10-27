/**
 * LLM gateway. Batches, caches, budgets, rate-limits and validates. The
 * product works with LLM_PROVIDER=none. See docs/07-llm-cost-strategy.md.
 */
import { createLlmCache } from './cache.js';
import { createCircuit, createTokenBucket, backoffMs, parseRetryAfter } from './scheduler.js';
import { providerFromConfig } from './providers.js';
import {
  BatchOut,
  MAX_BATCH,
  MAX_OUTPUT_TOKENS,
  MAX_VISION_PER_BATCH,
  SYSTEM_PROMPT,
  estimateTokens,
  isSafeDraft,
  userPrompt,
} from './safety.js';
export { naiveEstimateTokens, isSafeDraft, LLM_ASSISTED } from './safety.js';
export { buildLlmTasks } from './tasks.js';
export { emptyUsage, emptyTokenSummary } from './usage.js';

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function costUsd(prompt, completion, config) {
  const pin = config.LLM_PRICE_INPUT_PER_M;
  const pout = config.LLM_PRICE_OUTPUT_PER_M;
  if (!pin && !pout) return null;
  return (prompt / 1e6) * pin + (completion / 1e6) * pout;
}

function chunk(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/**
 * @param {object} config
 * @param {{ logger?: object, now?: () => number, sleep?: (ms: number) => Promise<void>,
 *   provider?: object, fetchImpl?: typeof fetch }} [deps]
 */
export function createLlmGateway(config, deps = {}) {
  const now = deps.now ?? Date.now;
  const wait = deps.sleep ?? defaultSleep;
  const logger = deps.logger;
  const provider = deps.provider ?? providerFromConfig(config, { fetchImpl: deps.fetchImpl });
  const cache = createLlmCache({ now });
  const circuit = createCircuit({ now });
  const rpm = createTokenBucket({ rate: config.LLM_RPM, capacity: config.LLM_RPM, now });
  const tpm = createTokenBucket({ rate: config.LLM_TPM, capacity: config.LLM_TPM, now });
  const daily = new Map();
  const cheap = config.LLM_MODEL_CHEAP || (provider.name === 'mock' ? 'mock-cheap' : 'gpt-4o-mini');
  const strong = config.LLM_MODEL_STRONG || '';
  const vision = config.LLM_MODEL_VISION || '';
  const dailyCap = config.LLM_TOKEN_BUDGET_PER_IP_DAY;

  const totals = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheHits: 0,
    dedupedItems: 0,
    count429: 0,
    estimatedCostUsd: 0,
    naiveEstimateTokens: 0,
    deterministicFixes: 0,
  };
  let queued = 0;

  function daySlot(ip) {
    const t = now();
    let e = daily.get(ip);
    if (!e || e.resetAt <= t) {
      e = { used: 0, resetAt: t + 86_400_000 };
      daily.set(ip, e);
    }
    return e;
  }

  function status() {
    if (!provider.enabled) return 'off';
    return circuit.status() === 'open' ? 'circuit-open' : 'on';
  }

  async function throttle(tokensEst) {
    queued += 1;
    try {
      for (;;) {
        const waitRpm = rpm.waitMs(1);
        const waitTpm = tpm.waitMs(tokensEst);
        const delay = Math.max(waitRpm, waitTpm);
        if (delay <= 0 && rpm.take(1) && tpm.take(tokensEst)) return;
        await wait(Math.min(delay || 50, 5_000));
      }
    } finally {
      queued -= 1;
    }
  }

  async function callModel(model, items, { scanLeft, ip }) {
    const visionCount = items.filter((t) => t.image).length;
    const est = estimateTokens(items, { vision: visionCount });
    if (est > scanLeft.tokens) return { kind: 'over-budget', est: 0 };
    const slot = daySlot(ip);
    if (slot.used + est > dailyCap) return { kind: 'over-budget', est: 0 };

    await throttle(est);
    if (!circuit.allow()) return { kind: 'circuit-open', est: 0 };

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent(items) },
    ];
    let lastErr;
    for (let attempt = 0; attempt <= 3; attempt += 1) {
      try {
        const res = await provider.chat({ model, messages, maxTokens: MAX_OUTPUT_TOKENS });
        circuit.success();
        const prompt = res.promptTokens || est;
        const completion = res.completionTokens || 40;
        const used = prompt + completion;
        slot.used += used;
        scanLeft.tokens = Math.max(0, scanLeft.tokens - used);
        totals.calls += 1;
        totals.promptTokens += prompt;
        totals.completionTokens += completion;
        totals.totalTokens += used;
        const c = costUsd(prompt, completion, config);
        if (c != null) totals.estimatedCostUsd += c;
        logger?.debug?.({ model, items: items.length, used }, 'llm call');
        return { kind: 'ok', text: res.text, model: res.model, used };
      } catch (err) {
        lastErr = err;
        if (err?.status === 429) totals.count429 += 1;
        const retryable = err?.status === 429 || (err?.status >= 500 && err?.status < 600) || err?.name === 'AbortError';
        if (!retryable || attempt === 3) {
          circuit.failure();
          logger?.warn?.({ err: err?.message, status: err?.status }, 'llm call failed');
          return { kind: 'error', est: 0 };
        }
        await wait(backoffMs(attempt, parseRetryAfter(err)));
      }
    }
    circuit.failure();
    logger?.warn?.({ err: lastErr?.message }, 'llm call failed');
    return { kind: 'error', est: 0 };
  }

  function parseItems(text, requested) {
    let parsed;
    try {
      parsed = BatchOut.safeParse(JSON.parse(text));
    } catch {
      return [];
    }
    if (!parsed.success) return [];
    const want = new Set(requested.map((t) => t.key));
    const byRule = new Map(requested.map((t) => [t.key, t.ruleId]));
    return parsed.data.items.filter(
      (it) => want.has(it.key) && isSafeDraft(it.text, byRule.get(it.key)),
    );
  }

  /**
   * @param {object[]} tasks  from buildLlmTasks
   * @param {{ ip?: string, scanBudget?: number }} [opts]
   */
  async function complete(tasks, { ip = 'local', scanBudget = config.LLM_TOKEN_BUDGET_PER_SCAN } = {}) {
    const snap = {
      calls: totals.calls,
      promptTokens: totals.promptTokens,
      completionTokens: totals.completionTokens,
      totalTokens: totals.totalTokens,
      estimatedCostUsd: totals.estimatedCostUsd,
    };
    const scanLeft = { tokens: scanBudget };
    const results = new Map();
    const unique = tasks;
    const fanout = unique.reduce((n, t) => n + t.repairIds.length, 0);
    const dedupedItems = Math.max(0, fanout - unique.length);

    const pending = [];
    for (const t of unique) {
      const hit = cache.get(t.key);
      if (hit) {
        results.set(t.key, { ...hit, status: 'cached' });
        totals.cacheHits += 1;
      } else pending.push(t);
    }

    if (!provider.enabled) {
      for (const t of pending) results.set(t.key, { text: null, confidence: 'low', status: 'error' });
    } else if (circuit.status() === 'open') {
      for (const t of pending) results.set(t.key, { text: null, confidence: 'low', status: 'circuit-open' });
    } else {
      const textItems = pending.filter((t) => t.tier !== 'vision');
      const visionItems = pending.filter((t) => t.tier === 'vision').slice(0, MAX_VISION_PER_BATCH);
      for (const extra of pending.filter((t) => t.tier === 'vision').slice(MAX_VISION_PER_BATCH)) {
        extra.tier = 'text';
        extra.image = null;
        textItems.push(extra);
      }

      const runBatches = async (items, model) => {
        for (const batch of chunk(items, MAX_BATCH)) {
          const res = await callModel(model, batch, { scanLeft, ip });
          if (res.kind !== 'ok') {
            const st = res.kind === 'over-budget' ? 'over-budget' : res.kind === 'circuit-open' ? 'circuit-open' : 'error';
            for (const t of batch) results.set(t.key, { text: null, confidence: 'low', status: st });
            continue;
          }
          const ok = parseItems(res.text, batch);
          const byKey = new Map(ok.map((i) => [i.key, i]));
          const retry = [];
          for (const t of batch) {
            const item = byKey.get(t.key);
            if (!item) {
              results.set(t.key, { text: null, confidence: 'low', status: 'error' });
              continue;
            }
            if (item.confidence === 'low' && (strong || model === cheap)) retry.push({ t, item });
            else {
              cache.set(t.key, { text: item.text, confidence: item.confidence });
              results.set(t.key, { text: item.text, confidence: item.confidence, status: 'ok' });
            }
          }
          if (retry.length && scanLeft.tokens > 0) {
            const retryModel = strong && model !== strong ? strong : cheap;
            const retryItems = retry.map((x) => x.t);
            const again = await callModel(retryModel, retryItems, { scanLeft, ip });
            const parsed = again.kind === 'ok' ? parseItems(again.text, retryItems) : [];
            const second = new Map(parsed.map((i) => [i.key, i]));
            for (const { t, item } of retry) {
              const better = second.get(t.key) ?? item;
              if (better?.text) {
                cache.set(t.key, { text: better.text, confidence: better.confidence ?? item.confidence });
                results.set(t.key, {
                  text: better.text,
                  confidence: better.confidence ?? item.confidence,
                  status: 'ok',
                });
              } else {
                results.set(t.key, { text: null, confidence: 'low', status: 'error' });
              }
            }
          }
        }
      };

      await runBatches(textItems, cheap);
      if (visionItems.length && vision) await runBatches(visionItems, vision);
      else if (visionItems.length) await runBatches(visionItems, cheap);
    }

    totals.dedupedItems += dedupedItems;
    const used = [...results.values()].filter((r) => r.status === 'ok' || r.status === 'cached');
    const priced = config.LLM_PRICE_INPUT_PER_M || config.LLM_PRICE_OUTPUT_PER_M;
    return {
      results,
      model: provider.enabled ? cheap : null,
      dedupedItems,
      cacheHits: [...results.values()].filter((r) => r.status === 'cached').length,
      budgetExhausted: [...results.values()].some((r) => r.status === 'over-budget'),
      circuitOpen: status() === 'circuit-open',
      used: used.length,
      usage: {
        calls: totals.calls - snap.calls,
        promptTokens: totals.promptTokens - snap.promptTokens,
        completionTokens: totals.completionTokens - snap.completionTokens,
        totalTokens: totals.totalTokens - snap.totalTokens,
        estimatedCostUsd: priced ? totals.estimatedCostUsd - snap.estimatedCostUsd : null,
      },
    };
  }

  function recordScan({ naiveEstimateTokens = 0, deterministicFixes = 0 } = {}) {
    totals.naiveEstimateTokens += naiveEstimateTokens;
    totals.deterministicFixes += deterministicFixes;
  }

  function usageRollup(extra = {}) {
    const total = totals.totalTokens;
    const naive = extra.naiveEstimateTokens ?? totals.naiveEstimateTokens;
    return {
      provider: provider.name,
      model: provider.enabled ? cheap : null,
      calls: totals.calls,
      promptTokens: totals.promptTokens,
      completionTokens: totals.completionTokens,
      totalTokens: total,
      cacheHits: totals.cacheHits,
      estimatedCostUsd: config.LLM_PRICE_INPUT_PER_M || config.LLM_PRICE_OUTPUT_PER_M ? totals.estimatedCostUsd : null,
      budget: config.LLM_TOKEN_BUDGET_PER_SCAN,
      budgetExhausted: extra.budgetExhausted ?? false,
      deterministicFixes: extra.deterministicFixes ?? totals.deterministicFixes,
      dedupedItems: totals.dedupedItems,
      naiveEstimateTokens: naive,
      tokensSaved: Math.max(0, naive - total),
      tokensPerVerifiedFix: extra.tokensPerVerifiedFix ?? null,
    };
  }

  return {
    name: provider.name,
    get enabled() {
      return provider.enabled;
    },
    status,
    complete,
    recordScan,
    usageRollup,
    limiterStats: () => ({
      queued,
      rpmRemaining: rpm.remaining(),
      tpmRemaining: tpm.remaining(),
      count429: totals.count429,
    }),
    /** Test helper: record a failure without a network call. */
    _circuit: circuit,
  };
}

function userContent(items) {
  const text = userPrompt(items);
  const images = items.filter((t) => t.image).slice(0, MAX_VISION_PER_BATCH);
  if (!images.length) return text;
  return [
    { type: 'text', text },
    ...images.map((t) => ({
      type: 'image_url',
      image_url: { url: `data:${t.image.mime};base64,${t.image.base64}` },
    })),
  ];
}

/** @param {{ LLM_PROVIDER: string, LLM_API_KEY: string }} config */
export function createLlmProvider(config, deps) {
  return createLlmGateway(config, deps);
}
