import { vi } from 'vitest';

export const health = (overrides = {}) => ({
  status: 'ok',
  version: '0.1.0',
  uptimeSec: 1,
  checks: { browser: 'up', store: 'memory', llm: 'off' },
  limits: { maxHtmlBytes: 512_000, privateUrlsAllowed: false },
  ...overrides,
});

const violation = (id, ruleId, impact, extra = {}) => ({
  id,
  ruleId,
  source: 'axe',
  outcome: 'violation',
  category: 'wcag',
  impact,
  wcag: {
    criteria: ['1.1.1'],
    level: 'A',
    refs: [
      {
        sc: '1.1.1',
        name: 'Non-text Content',
        level: 'A',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
      },
    ],
  },
  title: `${ruleId} title`,
  explanation: `${ruleId} explanation`,
  whoItAffects: 'Blind and low-vision people using screen readers',
  helpUrl: `https://dequeuniversity.com/rules/axe/4.14/${ruleId}`,
  node: { target: [`#${id}`], html: `<img id="${id}">`, failureSummary: 'Fix this' },
  signature: `${ruleId}:x`,
  status: 'open',
  ...extra,
});

export const completedScan = (overrides = {}) => ({
  id: 's_1',
  status: 'completed',
  stage: 'done',
  input: { type: 'html', bytes: 2048 },
  inputHash: 'a'.repeat(64),
  options: { includeAAA: false, includeBestPractice: true },
  violations: [
    violation('v1', 'image-alt', 'critical'),
    violation('v2', 'image-alt', 'critical'),
    violation('v3', 'color-contrast', 'serious'),
  ],
  manualReview: [
    violation('m1', 'color-contrast', 'serious', {
      outcome: 'needs-review',
      title: 'Contrast unclear',
    }),
  ],
  advisory: [
    violation('a1', 'heading-order', 'moderate', {
      category: 'best-practice',
      title: 'Heading levels skip a step',
    }),
  ],
  headingOutline: [
    { level: 1, text: 'Weekly specials', target: ['h1'] },
    { level: 3, text: 'Sourdough', target: ['h3'] },
  ],
  page: { finalUrl: null, title: 'Bakery', settled: true },
  network: { requests: 2, blocked: 1, blockedSamples: [] },
  engine: { axeVersion: '4.14.0' },
  timings: { totalMs: 1400 },
  score: null,
  error: null,
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  ...overrides,
});

const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  json: async () => body,
});

/**
 * Route-based fetch mock. `scans` is a list of GET /scans/:id replies served in order
 * (the last one repeats), so tests can walk a scan through its stages.
 */
export function mockApi({ healthBody = health(), create, scans = [completedScan()] } = {}) {
  let i = 0;
  const fn = vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/health') {
      return healthBody instanceof Error ? Promise.reject(healthBody) : reply(200, healthBody);
    }
    if (path === '/scans' && init.method === 'POST') {
      return create ?? reply(202, { id: 's_1', status: 'queued', stage: 'queued' });
    }
    if (path.startsWith('/scans/')) {
      const body = scans[Math.min(i++, scans.length - 1)];
      return reply(200, body);
    }
    return reply(404, { error: { code: 'NOT_FOUND', message: 'nope' } });
  });
  return fn;
}

export { reply };
