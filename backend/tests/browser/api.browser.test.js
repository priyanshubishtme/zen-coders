import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { fakeLookup, testConfig } from '../helpers.js';
import { describeBrowser, startFixtureServer, waitForScan } from './support.js';

describeBrowser('API with real Chromium: URL scans and hostile input', { timeout: 40_000 }, () => {
  let fixtures;
  let devApp;
  let prodLikeApp;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    const env = { SCAN_TIMEOUT_MS: '4000', SCAN_RATE_LIMIT_RPM: '1000' };
    devApp = createApp(testConfig({ ...env, ALLOW_PRIVATE_URLS: 'true' }));
    prodLikeApp = createApp(testConfig(env), {
      lookup: fakeLookup({ 'metadata.evil.test': ['169.254.169.254'] }),
    });
  });

  afterAll(async () => {
    for (const app of [devApp, prodLikeApp]) {
      await app?.locals.orchestrator.idle();
      await app?.locals.scanner.close();
    }
    await fixtures?.close();
  });

  it('scans a URL end to end and reports the final URL', async () => {
    const agent = request(devApp);
    const res = await agent
      .post('/scans')
      .send({ input: { type: 'url', url: `${fixtures.origin}/sample` } });
    expect(res.status).toBe(202);
    const scan = await waitForScan(agent, res.body.id);
    expect(scan.status).toBe('completed');
    expect(scan.page.finalUrl).toBe(`${fixtures.origin}/sample`);
    expect(scan.violations.map((v) => v.ruleId)).toEqual(
      expect.arrayContaining(['image-alt', 'label', 'color-contrast', 'html-has-lang']),
    );
    expect(scan.timings.totalMs).toBeGreaterThan(0);
  });

  // Each case must end in a typed error: either rejected up front, or a failed scan with a code.
  // Never a 500, never INTERNAL.
  const cases = [
    ['empty HTML', 'dev', { type: 'html', html: '' }, 400, null],
    [
      'binary data',
      'dev',
      { type: 'html', html: '\u0001\u0002\u0003\u0004\u0005'.repeat(50) },
      422,
      null,
    ],
    ['10 MB of HTML', 'dev', { type: 'html', html: `<p>${'a'.repeat(10_000_000)}</p>` }, 413, null],
    ['javascript: URL', 'dev', { type: 'url', url: 'javascript:alert(1)' }, 400, null],
    ['file: URL', 'dev', { type: 'url', url: 'file:///etc/passwd' }, 400, null],
    ['private IP URL', 'prod', { type: 'url', url: 'http://127.0.0.1/' }, 422, null],
    [
      'host resolving to cloud metadata',
      'prod',
      { type: 'url', url: 'http://metadata.evil.test/latest' },
      422,
      null,
    ],
    [
      'malformed tags',
      'dev',
      { type: 'html', html: '<div><p><span>unclosed <b>tags <img src=x' },
      202,
      'completed',
    ],
    [
      'infinite loop script',
      'dev',
      { type: 'html', html: '<script>while(true){}</script>' },
      202,
      'SCAN_TIMEOUT',
    ],
    ['redirect loop', 'dev', { type: 'url', url: '/loop' }, 202, 'FETCH_FAILED'],
    ['URL serving a PDF', 'dev', { type: 'url', url: '/doc.pdf' }, 202, 'UNSUPPORTED_INPUT'],
    ['URL returning 404', 'dev', { type: 'url', url: '/missing' }, 202, 'FETCH_FAILED'],
  ];

  it.each(cases)('%s -> typed outcome', async (_name, which, input, status, outcome) => {
    const app = which === 'dev' ? devApp : prodLikeApp;
    const agent = request(app);
    const body =
      input.type === 'url' && input.url.startsWith('/')
        ? { input: { type: 'url', url: `${fixtures.origin}${input.url}` } }
        : { input };
    const res = await agent.post('/scans').send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    if (status !== 202) {
      expect(res.body.error.code).not.toBe('INTERNAL');
      return;
    }
    const scan = await waitForScan(agent, res.body.id);
    if (outcome === 'completed') expect(scan.status).toBe('completed');
    else expect(scan.error).toMatchObject({ code: outcome });
  });

  it('blocks private subresources even when the page itself is pasted', async () => {
    const agent = request(prodLikeApp);
    const html = `<html lang="en"><head><title>t</title><link rel="stylesheet" href="${fixtures.origin}/faint.css"></head><body><img src="http://169.254.169.254/x.png" alt="x"></body></html>`;
    const res = await agent.post('/scans').send({ input: { type: 'html', html } });
    const scan = await waitForScan(agent, res.body.id);
    expect(scan.status).toBe('completed');
    expect(scan.network.blocked).toBe(2);
  });
});
