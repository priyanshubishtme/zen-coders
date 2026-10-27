import { afterAll, beforeAll, expect, it } from 'vitest';
import { createScanner } from '../../src/services/scanner/index.js';
import { normalize } from '../../src/services/scanner/normalize.js';
import { fakeLookup, testConfig } from '../helpers.js';
import { SAMPLE_HTML, describeBrowser, startFixtureServer } from './support.js';

const OPTIONS = { includeAAA: false, includeBestPractice: true };
const rules = (list) => [...new Set(list.map((v) => v.ruleId))].sort();

describeBrowser('scanner (real Chromium)', { timeout: 30_000 }, () => {
  let scanner;
  let fixtures;

  beforeAll(async () => {
    fixtures = await startFixtureServer();
    scanner = createScanner(testConfig({ SCAN_TIMEOUT_MS: '4000' }), {
      lookup: fakeLookup({ 'cdn.test': ['127.0.0.1'] }),
    });
    await scanner.scan({ type: 'html', html: '<p>warm up</p>' }, OPTIONS);
  });

  afterAll(async () => {
    await scanner?.close();
    await fixtures?.close();
  });

  it('finds exactly the planted issues in the broken sample, in under 5 s', async () => {
    const started = Date.now();
    const raw = await scanner.scan({ type: 'html', html: SAMPLE_HTML }, OPTIONS);
    const elapsed = Date.now() - started;
    const out = normalize(raw, { inputHash: 'sample' });

    expect(rules(out.violations)).toEqual([
      'button-name',
      'color-contrast',
      'html-has-lang',
      'image-alt',
      'label',
      'link-name',
    ]);
    expect(rules(out.advisory)).toEqual(
      expect.arrayContaining(['afx-heading-multiple-h1', 'afx-link-ambiguous', 'heading-order']),
    );
    expect(out.advisory.some((v) => v.ruleId === 'afx-heading-skip')).toBe(false);
    expect(rules(out.manualReview)).toContain('color-contrast');
    expect(raw.headingOutline.map((h) => h.level)).toEqual([1, 3, 1]);
    expect(raw.page.title).toBe('Bakery: weekly specials');
    expect(elapsed).toBeLessThan(5_000);
  });

  it('sees headings and vague links inside shadow DOM', async () => {
    const html = `<!doctype html><html lang="en"><body><main>
      <h1>Shop</h1>
      <product-card><template shadowrootmode="open">
        <h4>Rye loaf</h4><a href="/rye">Click here</a>
      </template></product-card></main></body></html>`;
    const raw = await scanner.scan({ type: 'html', html }, OPTIONS);
    expect(raw.headingOutline.map((h) => [h.level, h.text])).toEqual([
      [1, 'Shop'],
      [4, 'Rye loaf'],
    ]);
    const out = normalize(raw, { inputHash: 'shadow' });
    const link = out.advisory.find((v) => v.ruleId === 'afx-link-ambiguous');
    expect(link.node.target[0]).toContain('>>>');
  });

  it('blocks private subresources from pasted HTML and counts them', async () => {
    const html = `<html lang="en"><head><title>t</title>
      <link rel="stylesheet" href="${fixtures.origin}/faint.css"></head>
      <body><main><h1>Hi</h1><p class="faint">Faint text</p></main></body></html>`;
    const raw = await scanner.scan({ type: 'html', html }, OPTIONS);
    expect(raw.network.blocked).toBe(1);
    expect(raw.network.blockedSamples[0].reason).toMatch(/private or reserved/);
    expect(raw.violations.map((r) => r.id)).not.toContain('color-contrast');
  });

  it('loads allowed stylesheets through the pinned fetch, so contrast reflects real CSS', async () => {
    const devScanner = createScanner(testConfig({ ALLOW_PRIVATE_URLS: 'true' }), {
      lookup: fakeLookup({ 'cdn.test': ['127.0.0.1'] }),
    });
    try {
      const html = `<html lang="en"><head><title>t</title>
        <link rel="stylesheet" href="http://cdn.test:${fixtures.port}/faint.css"></head>
        <body><main><h1>Hi</h1><p class="faint">Faint text</p></main></body></html>`;
      const raw = await devScanner.scan({ type: 'html', html }, OPTIONS);
      expect(raw.network).toMatchObject({ requests: 1, blocked: 0 });
      expect(raw.violations.map((r) => r.id)).toContain('color-contrast');
    } finally {
      await devScanner.close();
    }
  });

  it('kills a page stuck in an infinite loop and keeps working afterwards', async () => {
    const started = Date.now();
    await expect(
      scanner.scan({ type: 'html', html: '<script>while(true){}</script><p>x</p>' }, OPTIONS),
    ).rejects.toMatchObject({ code: 'SCAN_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(8_000);

    const raw = await scanner.scan({ type: 'html', html: '<p>still alive</p>' }, OPTIONS);
    expect(raw.axeVersion).toMatch(/^4\./);
  });

  it('dismisses alert() dialogs instead of hanging', async () => {
    const raw = await scanner.scan(
      { type: 'html', html: '<script>alert("hi"); confirm("sure?")</script><p>x</p>' },
      OPTIONS,
    );
    expect(raw.axeVersion).toBeTruthy();
  });

  it('reports stages in order', async () => {
    const stages = [];
    await scanner.scan({ type: 'html', html: '<p>x</p>' }, OPTIONS, {
      onStage: (s) => stages.push(s),
    });
    expect(stages).toEqual(['loading', 'rendering', 'checking']);
  });
});
