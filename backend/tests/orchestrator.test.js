import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createMemoryScanRepository } from '../src/repositories/memoryScanRepository.js';
import { createOrchestrator } from '../src/services/orchestrator/index.js';
import { AppError } from '../src/utils/errors.js';
import { fakeLookup, fakeRaw, fakeScanner, testConfig } from './helpers.js';

const OPTIONS = { includeAAA: false, includeBestPractice: true };

function setup({ scanner = fakeScanner(), env, lookup } = {}) {
  const repo = createMemoryScanRepository();
  const orch = createOrchestrator({
    scanner,
    repo,
    config: testConfig(env),
    logger: pino({ level: 'silent' }),
    lookup,
  });
  return { orch, repo, scanner };
}

const html = (h) => ({ input: { type: 'html', html: h }, options: OPTIONS });

describe('orchestrator', () => {
  it('reports every stage in order and finishes with timings', async () => {
    const { orch, scanner } = setup();
    const { id } = await orch.createScan(html('<p>x</p>'));
    await orch.idle();
    const scan = await orch.getScan(id);
    expect(scanner.calls[0].stages).toEqual(['loading', 'rendering', 'checking']);
    expect(scan).toMatchObject({ status: 'completed', stage: 'done', error: null });
    expect(scan.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(scan.timings.queueMs).not.toBeNull();
    expect(scan.headingOutline).toEqual([{ level: 1, text: 'Hi', target: ['h1'], style: null }]);
    expect(scan.score).toMatchObject({ value: 0, weightedFailures: 10, weightedTotal: 10 });
    expect(scan.events.map((event) => event.stage)).toEqual(
      expect.arrayContaining(['render', 'axe', 'score']),
    );
  });

  it('stores a before screenshot in memory and numbers the matching pin', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const scanner = fakeScanner(async () => ({
      ...fakeRaw(),
      source: '<img src="a.jpg">',
      screenshot: jpeg,
      viewport: { width: 1280, height: 720 },
      pinFrames: [
        {
          key: 'image-alt\nimg',
          place: 'pin',
          x: 0.1,
          y: 0.2,
          w: 0.3,
          h: 0.1,
          name: '',
          role: 'img',
        },
      ],
    }));
    const { orch } = setup({ scanner });
    const { id } = await orch.createScan(html('<img src="a.jpg">'));
    await orch.idle();
    const scan = await orch.getScan(id);
    expect(scan.shots).toEqual({ before: true, after: false });
    expect(scan.marks[0]).toMatchObject({ n: 1, place: 'pin', violationId: scan.violations[0].id });
    expect(await orch.getScreenshot(id, 'before')).toBe(jpeg);
    expect(await orch.getSource(id)).toContain('<img');
  });

  it('stores the same input hash for the same input', async () => {
    const { orch } = setup();
    const a = await orch.createScan(html('<p>x</p>'));
    const b = await orch.createScan(html('<p>x</p>'));
    await orch.idle();
    expect((await orch.getScan(a.id)).inputHash).toBe((await orch.getScan(b.id)).inputHash);
  });

  it('strips NUL bytes before scanning', async () => {
    const { orch, scanner } = setup();
    await orch.createScan(html('<p>a\u0000b</p>'));
    await orch.idle();
    expect(scanner.calls[0].input.html).toBe('<p>ab</p>');
  });

  it.each([
    ['too large', 'x'.repeat(2_000), 'PAYLOAD_TOO_LARGE', { MAX_HTML_BYTES: '1000' }],
    ['binary', '\u0001\u0002\u0003\u0004<p>', 'UNSUPPORTED_INPUT', undefined],
    ['whitespace only', '   \n  ', 'UNSUPPORTED_INPUT', undefined],
  ])('rejects %s HTML before queueing', async (_name, input, code, env) => {
    const { orch, scanner } = setup({ env });
    await expect(orch.createScan(html(input))).rejects.toMatchObject({ code });
    expect(scanner.calls).toHaveLength(0);
  });

  it('rejects a URL that resolves to a private address before queueing', async () => {
    const { orch, scanner } = setup({ lookup: fakeLookup({ 'evil.test': ['10.0.0.1'] }) });
    await expect(
      orch.createScan({ input: { type: 'url', url: 'http://evil.test/' }, options: OPTIONS }),
    ).rejects.toMatchObject({ code: 'URL_BLOCKED' });
    expect(scanner.calls).toHaveLength(0);
  });

  it('records typed scanner errors on the scan', async () => {
    const scanner = fakeScanner(async () => {
      throw new AppError('SCAN_TIMEOUT', 'Scan exceeded 30000 ms.');
    });
    const { orch } = setup({ scanner });
    const { id } = await orch.createScan(html('<p>x</p>'));
    await orch.idle();
    expect(await orch.getScan(id)).toMatchObject({
      status: 'failed',
      stage: 'failed',
      error: { code: 'SCAN_TIMEOUT' },
    });
    expect(scanner.calls).toHaveLength(1);
  });

  it('retries unexpected crashes once, then completes', async () => {
    let n = 0;
    const scanner = fakeScanner(async () => {
      n += 1;
      if (n === 1) throw new TypeError('boom');
      return fakeRaw();
    });
    const { orch } = setup({ scanner });
    const { id } = await orch.createScan(html('<p>x</p>'));
    await orch.idle();
    expect(n).toBe(2);
    expect((await orch.getScan(id)).status).toBe('completed');
  });

  it('hides unexpected errors behind INTERNAL', async () => {
    const scanner = fakeScanner(async () => {
      throw new TypeError('secret stack detail');
    });
    const { orch } = setup({ scanner });
    const { id } = await orch.createScan(html('<p>x</p>'));
    await orch.idle();
    const scan = await orch.getScan(id);
    expect(scan.error.code).toBe('INTERNAL');
    expect(scan.error.message).not.toContain('secret');
  });
});
