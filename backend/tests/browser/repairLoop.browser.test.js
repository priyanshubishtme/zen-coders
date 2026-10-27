import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { CreateRepairsResponse, VerificationResult } from '../../src/schemas/index.js';
import { insertAt } from '../../src/services/repair/edits.js';
import { createScanner } from '../../src/services/scanner/index.js';
import { createVerifier } from '../../src/services/verifier/index.js';
import { testConfig } from '../helpers.js';
import { SAMPLE_HTML, describeBrowser, waitForScan } from './support.js';

/** Recompute doc 06's formula from the per-rule numbers the API returns. */
const byHand = (score) => {
  const fail = score.rules.reduce((n, r) => n + r.weight * r.fail, 0);
  const total = score.rules.reduce((n, r) => n + r.weight * (r.pass + r.fail), 0);
  const v = Math.floor(100 * (1 - fail / total) + 0.5);
  return fail > 0 && v >= 100 ? 99 : v;
};

describeBrowser('scan -> fix -> rescan loop, network and LLM off', { timeout: 60_000 }, () => {
  let app;
  let agent;
  let dnsCalls = 0;
  let scanId;
  let repairs;

  beforeAll(async () => {
    const offline = async () => {
      dnsCalls += 1;
      throw new Error('network is off');
    };
    app = createApp(testConfig({ SCAN_RATE_LIMIT_RPM: '1000', LLM_PROVIDER: 'none' }), {
      lookup: offline,
    });
    agent = request(app);
    const res = await agent.post('/scans').send({ input: { type: 'html', html: SAMPLE_HTML } });
    scanId = res.body.id;
    await waitForScan(agent, scanId);
  });

  afterAll(async () => {
    await app?.locals.orchestrator.idle();
    await app?.locals.scanner.close();
  });

  it('proposes one repair per issue and verifies the automatic ones before anything is applied', async () => {
    const res = await agent.post(`/scans/${scanId}/repairs`).send({});
    expect(res.status).toBe(200);
    const parsed = CreateRepairsResponse.safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    repairs = res.body.repairs;

    const status = Object.fromEntries(repairs.map((r) => [r.ruleId, r.status]));
    expect(status).toEqual({
      'button-name': 'verified',
      'color-contrast': 'verified',
      'html-has-lang': 'verified',
      'image-alt': 'needs-input',
      label: 'verified',
      'link-name': 'verified',
      'heading-order': 'verified',
      'afx-heading-multiple-h1': 'verified',
      'afx-link-ambiguous': 'verified',
    });
    expect(res.body.summary).toMatchObject({ verified: 8, needsInput: 1, regressed: 0, failed: 0 });
    for (const r of repairs.filter((x) => x.patch)) {
      expect(r.patch.diff).toMatch(/^Index: index\.html/);
      expect(r.patch.copy).toContain(r.patch.diff);
    }
    expect(dnsCalls).toBe(0);
  });

  it('applies all verified fixes, re-scans and explains the score with the documented formula', async () => {
    const ids = repairs.filter((r) => r.status === 'verified').map((r) => r.id);
    const res = await agent.post(`/scans/${scanId}/verify`).send({ repairIds: ids });
    expect(res.status).toBe(200);
    const parsed = VerificationResult.safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

    const v = res.body;
    expect(v.status).toBe('verified');
    expect(v.regressions).toEqual([]);
    expect(v.before.value).toBe(byHand(v.before));
    expect(v.after.value).toBe(byHand(v.after));
    expect(v.after.value).toBeGreaterThan(v.before.value);
    expect(v.remaining.map((x) => x.ruleId)).toEqual(['image-alt']);
    expect(v.resolved).toHaveLength(8);
    expect(v.manualReview.map((x) => x.ruleId)).toContain('color-contrast');
    expect(dnsCalls).toBe(0);

    const download = await agent.get(`/scans/${scanId}/patched.html`);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toMatch(/attachment/);
    expect(download.text).toContain('<html lang="en">');
    expect(download.text).not.toContain('data-afx-v');
  });

  it('never applies an unfilled placeholder', async () => {
    const img = repairs.find((r) => r.ruleId === 'image-alt');
    const res = await agent.post(`/scans/${scanId}/verify`).send({ repairIds: [img.id] });
    expect(res.body.repairs[0]).toMatchObject({
      outcome: 'not-applied',
      detail: 'Fill in the placeholder first.',
    });
    expect(res.body.status).toBe('failed');
  });

  it('reaches 100 once the user writes the alt text the template asked for', async () => {
    const ids = repairs.filter((r) => r.status === 'verified').map((r) => r.id);
    const img = repairs.find((r) => r.ruleId === 'image-alt');
    const res = await agent.post(`/scans/${scanId}/verify`).send({
      repairIds: [...ids, img.id],
      edits: [{ repairId: img.id, text: 'A crusty sourdough loaf on a board' }],
    });
    expect(res.body.after.value).toBe(100);
    expect(res.body.remaining).toEqual([]);
  });
});

describeBrowser('verifier against real axe', { timeout: 60_000 }, () => {
  let scanner;
  beforeAll(() => {
    scanner = createScanner(testConfig());
  });
  afterAll(() => scanner?.close());

  it('shows a deliberately bad fix as regressed and keeps the good one', async () => {
    const source =
      '<!doctype html>\n<html>\n<head><title>t</title></head>\n<body><main><h1>Hi</h1></main></body>\n</html>';
    const htmlPos = source.indexOf('<html') + 5;
    const bodyEnd = source.indexOf('</main>');
    const good = {
      id: 'good',
      ruleId: 'html-has-lang',
      _markPos: htmlPos,
      _css: [],
      _edits: [insertAt(htmlPos, ' lang="en"')],
    };
    const bad = {
      id: 'bad',
      ruleId: 'html-has-lang',
      _markPos: null,
      _css: [],
      _edits: [insertAt(bodyEnd, '<img src="x.png">')],
    };
    const verifier = createVerifier({ scanner });
    const result = await verifier.verify({
      scan: { input: { type: 'html' }, options: { includeAAA: false, includeBestPractice: true } },
      cached: { source, resources: new Map(), mainUrl: null },
      repairs: [good, bad],
    });
    expect(result.outcomes.get('good').outcome).toBe('resolved');
    expect(result.outcomes.get('bad').outcome).toBe('regressed');
    expect(result.patchedHtml).toContain('lang="en"');
    expect(result.patchedHtml).not.toContain('x.png');
  });
});
