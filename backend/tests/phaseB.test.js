import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';
import { canRead, canWrite } from '../src/services/access/decide.js';
import { hashPassword, verifyPassword } from '../src/services/auth/password.js';
import { SKIP_CAP, SKIP_TIME, runCrawl } from '../src/services/crawl/run.js';
import { parseRobots } from '../src/services/crawl/robots.js';
import { normalizeCrawlUrl } from '../src/services/crawl/url.js';
import { patternReport } from '../src/services/repair/site.js';
import { createMeter, memoryPersist, mongoPersist } from '../src/services/quota/meter.js';
import { crawlCaps } from '../src/services/quota/caps.js';
import { createMemorySecretStore, createVault, parseAuthKeys } from '../src/services/vault/authState.js';
import { pageFileName, zipStore } from '../src/services/export/zipStore.js';
import { buildLlmTasks } from '../src/services/llm/tasks.js';
import { waitForQuiet } from '../src/services/scanner/hydrate.js';
import { fakeLookup, fakeRaw, testApp } from './helpers.js';

const offline = fakeLookup({ 'example.com': ['127.0.0.1'], 'www.example.com': ['127.0.0.1'] });

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('crawl', () => {
  it('scans breadth-first and keeps the shallowest pages when the cap hits', async () => {
    const graph = {
      'https://example.com/': ['https://example.com/a', 'https://example.com/b'],
      'https://example.com/a': ['https://example.com/a/deep'],
      'https://example.com/b': [],
      'https://example.com/a/deep': ['https://example.com/a/deep/x'],
    };
    const order = [];
    const result = await runCrawl({
      seedUrl: 'https://example.com/',
      maxPages: 3,
      maxDepth: 2,
      budgetMs: 60_000,
      gapMs: 0,
      sleep: async () => {},
      scanPage: async ({ url }) => {
        order.push(url);
        return {
          finalUrl: url,
          links: graph[url] ?? [],
          record: { url, status: 'completed' },
        };
      },
    });
    expect(order).toEqual(['https://example.com/', 'https://example.com/a', 'https://example.com/b']);
    expect(result.pages.find((p) => p.url === 'https://example.com/a/deep').reason).toBe(SKIP_CAP);
    expect(result.pages.filter((p) => p.status === 'completed').map((p) => p.url)).toEqual(order);
  });

  it('pins the host after the seed redirect and drops other hosts', async () => {
    const seen = [];
    const result = await runCrawl({
      seedUrl: 'https://example.com/',
      maxPages: 10,
      maxDepth: 2,
      budgetMs: 60_000,
      gapMs: 0,
      sleep: async () => {},
      scanPage: async ({ url }) => {
        seen.push(url);
        if (url === 'https://example.com/') {
          return {
            finalUrl: 'https://www.example.com/',
            links: ['https://example.com/shop', 'https://www.example.com/about'],
            record: {},
          };
        }
        return { finalUrl: url, links: [], record: {} };
      },
    });
    expect(result.pinnedHost).toBe('www.example.com');
    expect(seen).toEqual(['https://example.com/', 'https://www.example.com/about']);
  });

  it('aborts the in-progress page on the time budget and does not store it as a result', async () => {
    const result = await runCrawl({
      seedUrl: 'https://example.com/',
      maxPages: 5,
      maxDepth: 2,
      budgetMs: 30,
      gapMs: 0,
      sleep: async () => {},
      scanPage: ({ signal }) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              finalUrl: 'https://example.com/',
              links: ['https://example.com/next'],
              record: { violations: [{ id: 'should-not-stick' }] },
            });
          }, 200);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    });
    expect(result.partial).toBe(true);
    expect(result.pages[0]).toMatchObject({ status: 'skipped', reason: SKIP_TIME });
    expect(result.pages[0].violations).toEqual([]);
    expect(JSON.stringify(result.pages)).not.toContain('should-not-stick');
  });

  it('reads robots disallow and crawl-delay', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /private\nCrawl-delay: 2\n');
    expect(rules.allowed('https://example.com/private/x')).toBe(false);
    expect(rules.allowed('https://example.com/public')).toBe(true);
    expect(rules.delayMs).toBe(2000);
  });

  it('normalizes trailing slashes and fragments', () => {
    expect(normalizeCrawlUrl('https://example.com/a/#top')).toBe('https://example.com/a');
  });
});

describe('accounts and limits', () => {
  it('hashes passwords with scrypt and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('nope', stored)).toBe(false);
  });

  it('hides someone else\'s scan and allows a live share read', () => {
    const scan = { id: 's_1', ownerId: 'u_a' };
    expect(canRead(scan, { userId: 'u_b' })).toBe(false);
    expect(canWrite(scan, { userId: 'u_b' })).toBe(false);
    expect(canRead(scan, { userId: 'u_a' })).toBe(true);
    expect(canRead({ id: 's_2', ownerId: null }, null)).toBe(true);
    expect(
      canRead(scan, { share: { scanId: 's_1', revoked: false, expiresAt: null } }, { allowShare: true }),
    ).toBe(true);
    expect(canWrite(scan, { share: { scanId: 's_1' } })).toBe(false);
  });

  it('keeps the process ceiling across a restart and reports it reached', async () => {
    const persist = memoryPersist();
    const now = () => Date.parse('2026-10-27T12:00:00Z');
    const first = createMeter({ persist, now, ceiling: 100 });
    await first.recordTokens({ n: 80, ownerKey: 'ip:1' });
    const second = createMeter({ persist, now, ceiling: 100 });
    expect(await second.tokensUsed('ip:1')).toBe(80);
    expect(await second.allowTokens({ est: 30, quotasEnabled: false, ceiling: 100, tierCap: 0, ownerKey: 'ip:1' })).toBe(
      'ceiling',
    );
    expect(await second.ceilingStatus(100)).toBe('reached');
    expect(await second.allowTokens({ est: 1, quotasEnabled: false, ceiling: 0, tierCap: 0, ownerKey: 'ip:1' })).toBe(
      'ok',
    );
  });

  it('persists a counter through the mongo-shaped adapter', async () => {
    const rows = new Map();
    const collection = {
      async findOne(filter) {
        return rows.get(filter.key) ?? null;
      },
      async findOneAndUpdate(filter, update) {
        const prev = rows.get(filter.key) ?? { key: filter.key, n: 0 };
        prev.n += update.$inc.n;
        rows.set(filter.key, prev);
        return { ...prev };
      },
    };
    const persist = mongoPersist(collection);
    expect(await persist.inc('ceiling:2026-10-27', 5)).toBe(5);
    expect(await persist.get('ceiling:2026-10-27')).toBe(5);
  });

  it('gives everyone the crawl cap while quotas are off, and Free/Pro only when they are on', () => {
    const config = loadConfig({});
    expect(config.QUOTAS_ENABLED).toBe(false);
    expect(config.CRAWL_MAX_PAGES).toBe(10);
    expect(config.LLM_TOKEN_BUDGET_PER_SCAN).toBe(0);
    expect(config.LLM_TOKEN_DAILY_CEILING).toBe(0);
    expect(config.SCAN_RATE_LIMIT_RPM).toBe(30);
    expect(crawlCaps(config, 'free')).toEqual({ maxPages: 10, maxDepth: 2 });
    const on = loadConfig({ QUOTAS_ENABLED: 'true' });
    expect(crawlCaps(on, 'free').maxPages).toBe(5);
    expect(crawlCaps(on, 'pro').maxPages).toBe(10);
  });

  it('refuses a ceiling smaller than the per-scan budget, and Redis without mongo', () => {
    expect(() => loadConfig({ LLM_TOKEN_DAILY_CEILING: '100', LLM_TOKEN_BUDGET_PER_SCAN: '8000' })).toThrow(
      /CEILING/,
    );
    expect(() => loadConfig({ REDIS_URL: 'redis://localhost:6379', STORE: 'memory' })).toThrow(/STORE=mongo/);
    expect(() => loadConfig({ PRO_TOKENS_DAY: '10', FREE_TOKENS_DAY: '10' })).toThrow(/PRO_TOKENS_DAY/);
  });

  it('round-trips a scan secret and deletes it', async () => {
    const keys = parseAuthKeys(`k1:${KEY}`);
    const store = createMemorySecretStore();
    const vault = createVault({ keys, store, ttlMs: 1000 });
    await vault.put('s_1', { cookies: [{ name: 'sid', value: 'secret' }] });
    expect(JSON.stringify(store)).not.toContain('secret');
    expect((await vault.read('s_1')).cookies[0].value).toBe('secret');
    await vault.delete('s_1');
    expect(await vault.read('s_1')).toBeNull();
  });

  it('does not count a pattern fixed when one page failed', () => {
    const report = patternReport([
      { url: 'https://example.com/a', repairs: [{ id: 'r1', signature: 'image-alt:x', ruleId: 'image-alt', status: 'verified' }] },
      { url: 'https://example.com/b', repairs: [{ id: 'r2', signature: 'image-alt:x', ruleId: 'image-alt', status: 'failed' }] },
    ]);
    expect(report[0].verified).toBe(false);
    expect(report[0].pages).toHaveLength(2);
  });

  it('builds one LLM task per pattern when asked', () => {
    const repairs = [
      { id: 'r1', ruleId: 'image-alt', strategy: 'template', violationId: 'v1', signature: 'image-alt:same' },
      { id: 'r2', ruleId: 'image-alt', strategy: 'template', violationId: 'v2', signature: 'image-alt:same' },
    ];
    const ctx = {
      findings: [
        { id: 'v1', signature: 'image-alt:same', node: { target: ['img'], html: '<img>' } },
        { id: 'v2', signature: 'image-alt:same', node: { target: ['img'], html: '<img>' } },
      ],
      locate: () => ({ el: null }),
      $: () => ({ closest: () => ({ find: () => ({ first: () => ({ text: () => '' }) }) }), prev: () => ({ text: () => '' }), next: () => ({ text: () => '' }) }),
    };
    const tasks = buildLlmTasks(repairs, { ctx, cached: { resources: new Map() }, model: 'm', byPattern: true });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].repairIds).toEqual(['r1', 'r2']);
  });

  it('names zip entries without the URL path and refuses to imply a huge archive', () => {
    expect(pageFileName(0)).toBe('page-01.html');
    const buf = zipStore([{ name: 'page-01.html', data: '<p>ok</p>' }, { name: 'manifest.json', data: '{}' }]);
    expect(buf.subarray(0, 2).toString('hex')).toBe('504b');
  });
});

describe('phase B HTTP', () => {
  const origin = 'http://localhost:5173';

  async function signup(app, email) {
    const res = await request(app).post('/signup').send({ email, password: 'long-password' });
    expect(res.status).toBe(201);
    return res.headers['set-cookie'][0].split(';')[0];
  }

  it('reports quotas off and authenticated scanning disabled when no key is set', async () => {
    const res = await request(testApp()).get('/health');
    expect(res.body.quotas).toBe('off');
    expect(res.body.tokenCeiling).toBe('ok');
    expect(res.body.authenticatedScanning).toBe('disabled: no key');
  });

  it('returns 404 for another user on the scan, the report, and repairs', async () => {
    const app = testApp();
    const cookieA = await signup(app, 'a@example.com');
    const cookieB = await signup(app, 'b@example.com');
    const created = await request(app)
      .post('/scans')
      .set('Cookie', cookieA)
      .set('Origin', origin)
      .set('x-accessfix-request', '1')
      .send({ input: { type: 'html', html: '<p>hi</p>' } });
    expect(created.status).toBe(202);
    await app.locals.orchestrator.idle();
    const denied = await request(app).get(`/scans/${created.body.id}`).set('Cookie', cookieB);
    const missing = await request(app).get('/scans/s_does_not_exist_123456789');
    expect(denied.status).toBe(404);
    expect(denied.body.error.message).toBe(missing.body.error.message);
    const report = await request(app).get(`/scans/${created.body.id}/report`).set('Cookie', cookieB);
    expect(report.status).toBe(404);
    const repairs = await request(app)
      .post(`/scans/${created.body.id}/repairs`)
      .set('Cookie', cookieB)
      .set('Origin', origin)
      .set('x-accessfix-request', '1')
      .send({});
    expect(repairs.status).toBe(404);
  });

  it('rejects a cookie mutation without the CSRF header, and still allows a cookieless scan', async () => {
    const app = testApp();
    const cookie = await signup(app, 'c@example.com');
    const blocked = await request(app).post('/logout').set('Cookie', cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CSRF');
    const open = await request(app).post('/scans').send({ input: { type: 'html', html: '<p>anon</p>' } });
    expect(open.status).toBe(202);
    await app.locals.orchestrator.idle();
  });

  it('uses one generic login error and does not lock the account', async () => {
    const app = testApp();
    await signup(app, 'd@example.com');
    const bad = await request(app).post('/login').send({ email: 'd@example.com', password: 'wrong-password' });
    const unknown = await request(app).post('/login').send({ email: 'nobody@example.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe('Invalid email or password.');
    expect(unknown.body.error.message).toBe(bad.body.error.message);
    const tooSoon = await request(app).post('/login').send({ email: 'd@example.com', password: 'long-password' });
    expect(tooSoon.status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = await request(app).post('/login').send({ email: 'd@example.com', password: 'long-password' });
    expect(again.status).toBe(200);
  });

  it('shares a private scan read-only and refuses an authenticated scan', async () => {
    const app = testApp({
      env: { AUTH_STATE_KEYS: `k1:${KEY}`, ALLOW_PRIVATE_URLS: 'true' },
      lookup: offline,
    });
    const cookie = await signup(app, 'e@example.com');
    const headers = { Cookie: cookie, Origin: origin, 'x-accessfix-request': '1' };
    const created = await request(app)
      .post('/scans')
      .set(headers)
      .send({ input: { type: 'html', html: '<p>share me</p>' } });
    await app.locals.orchestrator.idle();
    const share = await request(app).post(`/scans/${created.body.id}/share`).set(headers).send({});
    expect(share.status).toBe(201);
    expect(share.body.path).toMatch(/^\/shares\/[A-Za-z0-9_-]+$/);
    const report = await request(app).get(share.body.path);
    expect(report.status).toBe(200);
    expect(report.headers['cache-control']).toMatch(/no-store/);
    expect(JSON.stringify(report.body)).not.toContain('e@example.com');
    const source = await request(app).get(`/scans/${created.body.id}/source`);
    expect(source.status).toBe(404);

    const authed = await request(app)
      .post('/scans')
      .set(headers)
      .send({
        input: { type: 'url', url: 'https://example.com/' },
        auth: { cookies: [{ name: 'sid', value: 'super-secret' }] },
      });
    expect(authed.status).toBe(202);
    const deniedShare = await request(app).post(`/scans/${authed.body.id}/share`).set(headers).send({});
    expect(deniedShare.status).toBe(400);
    expect(deniedShare.body.error.message).toMatch(/cannot be shared/);
    await app.locals.orchestrator.idle();
    expect(await app.locals.vault.read(authed.body.id)).toBeNull();
    const body = JSON.stringify(authed.body);
    expect(body).not.toContain('super-secret');
  });

  it('streams a five-page crawl one page after another', async () => {
    const pages = {
      'https://example.com/': ['https://example.com/a', 'https://example.com/b'],
      'https://example.com/a': ['https://example.com/c'],
      'https://example.com/b': ['https://example.com/d'],
      'https://example.com/c': [],
      'https://example.com/d': [],
    };
    let current = 0;
    const scanner = {
      calls: [],
      async scan(input) {
        current += 1;
        const at = current;
        scanner.calls.push({ url: input.url, at });
        if (at > 1) expect(scanner.calls[at - 2].at).toBe(at - 1);
        return {
          ...fakeRaw(),
          source: `<html><title>${input.url}</title></html>`,
          resources: new Map(),
          links: pages[input.url] ?? [],
          page: { finalUrl: input.url, title: input.url, settled: true },
          passes: [],
        };
      },
      health: async () => 'down',
      stats: () => ({ active: 0, queued: 0, maxContexts: 1 }),
      close: async () => {},
    };
    const app = testApp({
      env: { CRAWL_GAP_MS: '0', CRAWL_BUDGET_MS: '60000', ALLOW_PRIVATE_URLS: 'true' },
      lookup: offline,
      scanner,
    });
    const cookie = await signup(app, 'crawl@example.com');
    const created = await request(app)
      .post('/scans')
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('x-accessfix-request', '1')
      .send({ input: { type: 'url', url: 'https://example.com/' }, options: { crawl: true } });
    expect(created.status).toBe(202);
    await app.locals.orchestrator.idle();
    const got = await request(app)
      .get(`/scans/${created.body.id}`)
      .set('Cookie', cookie);
    expect(got.body.status).toBe('completed');
    expect(got.body.pages.filter((p) => p.status === 'completed')).toHaveLength(5);
    expect(scanner.calls.map((c) => c.url)).toEqual([
      'https://example.com/',
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/d',
    ]);
    const repairs = await request(app)
      .post(`/scans/${created.body.id}/repairs`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('x-accessfix-request', '1')
      .send({});
    expect(repairs.status).toBe(200);
  });
});

describe('DOM quiet wait', () => {
  it('gives the page one argument, because Playwright evaluate only forwards one', async () => {
    let passed;
    const page = {
      evaluate: async (_fn, arg) => {
        passed = arg;
        return true;
      },
    };
    await expect(waitForQuiet(page, 500, 15_000)).resolves.toBe(true);
    expect(passed).toEqual({ quiet: 500, cap: 15_000 });
  });
});
