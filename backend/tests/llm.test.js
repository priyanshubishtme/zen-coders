import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UsageResponse } from '../src/schemas/index.js';
import { loadConfig } from '../src/config/env.js';
import { createMemoryScanRepository } from '../src/repositories/memoryScanRepository.js';
import { createLlmGateway, createLlmProvider, isSafeDraft } from '../src/services/llm/index.js';
import { createOrchestrator } from '../src/services/orchestrator/index.js';
import { fakeRaw, fakeScanner, testApp, testConfig } from './helpers.js';

const HTML = `<!doctype html><html lang="en"><head><title>T</title></head><body>
<img src="loaf.jpg" width="120" height="80">
</body></html>`;

function scannerWithSource() {
  return fakeScanner(async (input) => ({
    ...fakeRaw(),
    source: input.html ?? HTML,
    resources: new Map(),
  }));
}

function setup({ env = {} } = {}) {
  const config = testConfig(env);
  const llm = createLlmProvider(config, { sleep: async () => {} });
  const orch = createOrchestrator({
    scanner: scannerWithSource(),
    repo: createMemoryScanRepository(),
    config,
    logger: pino({ level: 'silent' }),
    llm,
  });
  return { orch, llm, config };
}

async function scanned(orch, html = HTML) {
  const { id } = await orch.createScan({
    input: { type: 'html', html },
    options: { includeAAA: false, includeBestPractice: true },
  });
  await orch.idle();
  return id;
}

describe('isSafeDraft', () => {
  it('rejects HTML tags, entities, URLs and TODO', () => {
    expect(isSafeDraft('A crusty sourdough loaf', 'image-alt')).toBe(true);
    expect(isSafeDraft('<b>loaf</b>', 'image-alt')).toBe(false);
    expect(isSafeDraft('loaf &amp; jam', 'image-alt')).toBe(false);
    expect(isSafeDraft('See https://example.com', 'image-alt')).toBe(false);
    expect(isSafeDraft('www.bakery.test', 'image-alt')).toBe(false);
    expect(isSafeDraft('TODO: describe this', 'image-alt')).toBe(false);
    expect(isSafeDraft('line\nbreak', 'image-alt')).toBe(false);
  });
});

describe('loadConfig', () => {
  it('turns trust proxy on in production when unset', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).TRUST_PROXY).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(loadConfig({}).TRUST_PROXY).toBe(false);
    expect(loadConfig({}).LLM_TOKEN_BUDGET_PER_IP_DAY).toBe(100_000);
    expect(loadConfig({}).LLM_MODEL_STRONG).toBe('');
  });
});

describe('LLM gateway', () => {
  const task = {
    key: 'k1',
    ruleId: 'image-alt',
    snippet: '<img src="loaf.jpg">',
    context: 'Weekly specials',
    tier: 'text',
    image: null,
    repairIds: ['r1', 'r2'],
  };

  it('mock provider drafts words, counts tokens, and saves versus naive', async () => {
    const gw = createLlmGateway(testConfig({ LLM_PROVIDER: 'mock' }), { sleep: async () => {} });
    const res = await gw.complete([task]);
    expect(res.results.get('k1').text).toMatch(/sourdough|Weekly|Photo|loaf/i);
    expect(res.usage.totalTokens).toBeGreaterThan(0);
    expect(res.dedupedItems).toBe(1);
    gw.recordScan({ naiveEstimateTokens: 2000, deterministicFixes: 4 });
    const usage = gw.usageRollup();
    expect(usage.tokensSaved).toBeGreaterThan(0);
    expect(usage.provider).toBe('mock');
  });

  it('openai-compatible posts JSON-mode chat completions through a fake HTTP client', async () => {
    const fetchImpl = async (url, init) => {
      expect(url).toMatch(/\/chat\/completions$/);
      const body = JSON.parse(init.body);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(JSON.stringify(body.messages)).toContain('<untrusted>');
      return {
        ok: true,
        json: async () => ({
          model: 'fake-mini',
          usage: { prompt_tokens: 40, completion_tokens: 12 },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [{ key: 'k1', text: 'A crusty sourdough loaf', confidence: 'high' }],
                }),
              },
            },
          ],
        }),
      };
    };
    const gw = createLlmGateway(
      testConfig({
        LLM_PROVIDER: 'openai-compatible',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL_CHEAP: 'fake-mini',
      }),
      { fetchImpl, sleep: async () => {} },
    );
    const res = await gw.complete([task]);
    expect(res.results.get('k1').text).toBe('A crusty sourdough loaf');
    expect(res.usage.promptTokens).toBe(40);
  });

  it('drops drafts that contain HTML or URLs', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [{ key: 'k1', text: '<img src="https://evil.test">', confidence: 'high' }],
              }),
            },
          },
        ],
      }),
    });
    const gw = createLlmGateway(
      testConfig({ LLM_PROVIDER: 'openai-compatible', LLM_API_KEY: 'sk-test' }),
      { fetchImpl, sleep: async () => {} },
    );
    const res = await gw.complete([task]);
    expect(res.results.get('k1').text).toBeNull();
  });

  it('serves a second identical task from cache', async () => {
    const gw = createLlmGateway(testConfig({ LLM_PROVIDER: 'mock' }), { sleep: async () => {} });
    await gw.complete([task]);
    const again = await gw.complete([task]);
    expect(again.cacheHits).toBe(1);
    expect(again.usage.calls).toBe(0);
    expect(again.results.get('k1').status).toBe('cached');
  });

  it('falls back to none when the API key is empty', async () => {
    const gw = createLlmProvider(
      testConfig({ LLM_PROVIDER: 'openai-compatible', LLM_API_KEY: '' }),
    );
    expect(gw.enabled).toBe(false);
    expect(gw.status()).toBe('off');
  });
});

describe('repair flow with LLM', () => {
  it('keeps patches identical when the LLM is off or useLlm is false', async () => {
    const none = setup({ env: { LLM_PROVIDER: 'none' } });
    const mock = setup({ env: { LLM_PROVIDER: 'mock' } });
    const idNone = await scanned(none.orch);
    const idMock = await scanned(mock.orch);
    const a = await none.orch.proposeRepairs(idNone, { useLlm: true });
    const b = await mock.orch.proposeRepairs(idMock, { useLlm: false });
    const patchOf = (res) =>
      res.repairs.map((r) => ({ ruleId: r.ruleId, strategy: r.strategy, after: r.patch?.after }));
    expect(patchOf(a)).toEqual(patchOf(b));
    expect(a.repairs.find((r) => r.ruleId === 'image-alt').strategy).toBe('template');
  });

  it('drafts alt text with the mock provider and reports token savings', async () => {
    const { orch } = setup({ env: { LLM_PROVIDER: 'mock' } });
    const id = await scanned(orch);
    const res = await orch.proposeRepairs(id, { useLlm: true });
    const img = res.repairs.find((r) => r.ruleId === 'image-alt');
    expect(img.strategy).toBe('llm');
    expect(img.accepted).toBe(false);
    expect(img.draft).toBeTruthy();
    expect(img.status).toBe('needs-input');
    expect(res.tokenUsage.tokensSaved).toBeGreaterThan(0);
    expect(res.tokenUsage.totalTokens).toBeGreaterThan(0);
  });

  it('refuses to apply an unaccepted LLM draft', async () => {
    const { orch } = setup({ env: { LLM_PROVIDER: 'mock' } });
    const id = await scanned(orch);
    const proposed = await orch.proposeRepairs(id, { useLlm: true });
    const img = proposed.repairs.find((r) => r.ruleId === 'image-alt');
    const denied = await orch.verify(id, { repairIds: [img.id] });
    expect(denied.repairs[0]).toMatchObject({
      repairId: img.id,
      outcome: 'not-applied',
      detail: 'Accept the AI draft first.',
    });
    const accepted = await orch.verify(id, {
      repairIds: [img.id],
      acceptedRepairIds: [img.id],
    });
    expect(accepted.repairs[0].detail).not.toBe('Accept the AI draft first.');
  });

  it('rejects HTML or URL wording even after accept', async () => {
    const { orch } = setup({ env: { LLM_PROVIDER: 'mock' } });
    const id = await scanned(orch);
    const proposed = await orch.proposeRepairs(id, { useLlm: true });
    const img = proposed.repairs.find((r) => r.ruleId === 'image-alt');
    const res = await orch.verify(id, {
      repairIds: [img.id],
      acceptedRepairIds: [img.id],
      edits: [{ repairId: img.id, text: '<b>loaf</b>' }],
    });
    expect(res.repairs[0]).toMatchObject({
      outcome: 'not-applied',
      detail: expect.stringMatching(/plain words/i),
    });
  });
});

describe('health and usage', () => {
  it('reports circuit-open on /health', async () => {
    const res = await request(
      testApp({ llm: { enabled: true, status: () => 'circuit-open' } }),
    ).get('/health');
    expect(res.body.checks.llm).toBe('circuit-open');
  });

  it('returns process token totals on GET /usage after a mock repair', async () => {
    const app = testApp({
      env: { LLM_PROVIDER: 'mock' },
      scanner: scannerWithSource(),
    });
    const created = await request(app).post('/scans').send({ input: { type: 'html', html: HTML } });
    await app.locals.orchestrator.idle();
    await request(app).post(`/scans/${created.body.id}/repairs`).send({ useLlm: true });
    const usage = await request(app).get('/usage');
    expect(UsageResponse.safeParse(usage.body).success).toBe(true);
    expect(usage.body.tokens.totalTokens).toBeGreaterThan(0);
    expect(usage.body.tokens.tokensSaved).toBeGreaterThan(0);
  });
});
