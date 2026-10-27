import { MAX_OUTPUT_TOKENS } from './safety.js';

export function createNoneProvider() {
  return {
    name: 'none',
    enabled: false,
    async chat() {
      throw new Error('LLM is off');
    },
  };
}

/** Canned drafts for tests and demos. Counts tokens from the prompt size. */
export function createMockProvider() {
  return {
    name: 'mock',
    enabled: true,
    async chat({ messages, model }) {
      const user = messages.find((m) => m.role === 'user');
      const raw = typeof user?.content === 'string' ? user.content : JSON.stringify(user?.content);
      const block =
        [...String(raw).matchAll(/<untrusted>\s*([\s\S]*?)\s*<\/untrusted>/g)].at(-1)?.[1] ?? '{}';
      let keys = [];
      try {
        keys = JSON.parse(block).items ?? [];
      } catch {
        keys = [];
      }
      const items = keys.map((it) => ({
        key: it.key,
        text: mockText(it.ruleId, it.context, it.snippet),
        confidence: 'medium',
      }));
      const text = JSON.stringify({ items });
      const promptTokens = Math.ceil(raw.length / 4) + 20;
      return {
        text,
        model: model ?? 'mock-cheap',
        promptTokens,
        completionTokens: Math.ceil(text.length / 4),
      };
    },
  };
}

function mockText(ruleId, context = '', snippet = '') {
  if (ruleId === 'image-alt' || ruleId === 'input-image-alt') {
    const near = String(context).replace(/\s+/g, ' ').trim().slice(0, 40);
    return near ? `Photo of ${near}`.slice(0, 125) : 'A crusty sourdough loaf on a board';
  }
  if (ruleId === 'label' || ruleId === 'select-name') return 'Email';
  if (ruleId === 'button-name' || ruleId === 'input-button-name') {
    if (/menu/i.test(snippet + context)) return 'Menu';
    return 'Submit';
  }
  if (ruleId === 'link-name') {
    if (/cart/i.test(snippet + context)) return 'Cart';
    return 'Read more';
  }
  return 'More information';
}

/**
 * OpenAI-compatible Chat Completions. `fetchImpl` is injectable for tests.
 * @param {{ LLM_BASE_URL: string, LLM_API_KEY: string, LLM_MODEL_CHEAP: string }} config
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [deps]
 */
export function createOpenAiProvider(config, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const base = config.LLM_BASE_URL.replace(/\/$/, '');
  const key = config.LLM_API_KEY;
  return {
    name: 'openai-compatible',
    enabled: Boolean(key),
    async chat({ model, messages, maxTokens = MAX_OUTPUT_TOKENS }) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      let res;
      try {
        res = await fetchImpl(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 0,
            response_format: { type: 'json_object' },
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
      if (!res.ok) {
        const err = new Error(`LLM HTTP ${res.status}`);
        err.status = res.status;
        err.headers = res.headers;
        throw err;
      }
      const body = await res.json();
      const text = body.choices?.[0]?.message?.content ?? '';
      return {
        text,
        model: body.model ?? model,
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
      };
    },
  };
}

export function providerFromConfig(config, deps = {}) {
  if (config.LLM_PROVIDER === 'mock') return createMockProvider();
  if (config.LLM_PROVIDER === 'openai-compatible' && config.LLM_API_KEY) {
    return createOpenAiProvider(config, deps);
  }
  return createNoneProvider();
}
