import { vi } from 'vitest';

export const health = (overrides = {}) => ({
  status: 'ok',
  version: '0.1.0',
  uptimeSec: 1,
  checks: { browser: 'up', store: 'memory', llm: 'off' },
  limits: { maxHtmlBytes: 5_000_000, privateUrlsAllowed: false },
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

export const sampleScore = (overrides = {}) => ({
  value: 62,
  formulaVersion: 1,
  standard: 'WCAG 2.2 AA',
  rulesChecked: 8,
  elementsChecked: 20,
  failingElements: 5,
  weightedFailures: 40,
  weightedTotal: 105,
  byImpact: {
    critical: { fail: 2, pass: 3 },
    serious: { fail: 3, pass: 6 },
    moderate: { fail: 0, pass: 4 },
    minor: { fail: 0, pass: 2 },
  },
  rules: [
    { ruleId: 'image-alt', impact: 'critical', weight: 10, pass: 1, fail: 2 },
    { ruleId: 'color-contrast', impact: 'serious', weight: 7, pass: 4, fail: 1 },
  ],
  manualReviewCount: 1,
  advisoryCount: 2,
  engine: { axeVersion: '4.14.0' },
  ...overrides,
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
  score: sampleScore(),
  error: null,
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  ...overrides,
});

export const sampleRepair = (overrides = {}) => ({
  id: 'r1',
  violationId: 'v1',
  ruleId: 'image-alt',
  strategy: 'template',
  status: 'needs-input',
  confidence: 'medium',
  patch: {
    kind: 'attribute',
    target: ['#v1'],
    before: '<img id="v1">',
    after: '<img id="v1" alt="TODO: describe this image">',
    diff: '--- original\n+++ patched\n@@ -1 +1 @@\n-<img id="v1">\n+<img id="v1" alt="TODO: describe this image">\n',
    copy: 'Add a short description of the image.\n\n--- original\n+++ patched\n@@ -1 +1 @@\n-<img id="v1">\n+<img id="v1" alt="TODO: describe this image">\n',
  },
  rationale: 'Add a short description of the image.',
  notes: ['Write what the image shows.'],
  needsHumanInput: true,
  placeholder: 'TODO: describe this image',
  tokenUsage: null,
  verification: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const sampleRepairsResponse = (overrides = {}) => ({
  scanId: 's_1',
  repairs: [
    sampleRepair(),
    sampleRepair({
      id: 'r2',
      violationId: 'v2',
      patch: {
        kind: 'attribute',
        target: ['#v2'],
        before: '<img id="v2">',
        after: '<img id="v2" alt="TODO: describe this image">',
        diff: '-<img id="v2">\n+<img id="v2" alt="TODO: describe this image">\n',
        copy: 'Add a short description of the image.',
      },
    }),
    sampleRepair({
      id: 'r3',
      violationId: 'v3',
      ruleId: 'color-contrast',
      strategy: 'deterministic',
      status: 'verified',
      confidence: 'high',
      placeholder: null,
      needsHumanInput: false,
      notes: [],
      rationale: 'Darken the text colour so it meets 4.5:1 contrast.',
      patch: {
        kind: 'css',
        target: ['#v3'],
        before: 'color: #777;',
        after: 'color: #444;',
        diff: '-color: #777;\n+color: #444;\n',
        copy: 'Darken the text colour so it meets 4.5:1 contrast.\n\n-color: #777;\n+color: #444;\n',
      },
    }),
  ],
  summary: {
    verified: 1,
    failed: 0,
    regressed: 0,
    notApplied: 0,
    needsInput: 2,
    manual: 0,
    scansRun: 2,
  },
  tokenUsage: { provider: 'none', model: null, calls: 0, totalTokens: 0 },
  ...overrides,
});

export const sampleVerification = (overrides = {}) => ({
  id: 'ver_1',
  scanId: 's_1',
  status: 'verified',
  repairs: [{ repairId: 'r3', outcome: 'resolved', detail: null }],
  resolved: [violation('v3', 'color-contrast', 'serious', { title: 'color-contrast title' })],
  remaining: [violation('v1', 'image-alt', 'critical'), violation('v2', 'image-alt', 'critical')],
  regressions: [],
  manualReview: [
    violation('m1', 'color-contrast', 'serious', {
      outcome: 'needs-review',
      title: 'Contrast unclear',
    }),
  ],
  before: sampleScore(),
  after: sampleScore({ value: 98, failingElements: 2, weightedFailures: 20 }),
  patchedHtml: '<html lang="en"><body>patched</body></html>',
  scansRun: 2,
  durationMs: 900,
  verifiedAt: new Date().toISOString(),
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
export function mockApi({
  healthBody = health(),
  create,
  scans = [completedScan()],
  repairs = sampleRepairsResponse(),
  verify = sampleVerification(),
} = {}) {
  let i = 0;
  const fn = vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/health') {
      return healthBody instanceof Error ? Promise.reject(healthBody) : reply(200, healthBody);
    }
    if (path === '/scans' && init.method === 'POST') {
      return create ?? reply(202, { id: 's_1', status: 'queued', stage: 'queued' });
    }
    if (path.endsWith('/repairs') && init.method === 'POST') {
      if (repairs instanceof Error) return Promise.reject(repairs);
      return typeof repairs?.ok === 'boolean' ? repairs : reply(200, repairs);
    }
    if (path.endsWith('/verify') && init.method === 'POST') {
      if (verify instanceof Error) return Promise.reject(verify);
      return typeof verify?.ok === 'boolean' ? verify : reply(200, verify);
    }
    if (path === '/me') return reply(401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
    if (path.endsWith('/events')) return reply(200, {});
    if (path.startsWith('/scans/')) {
      const body = scans[Math.min(i++, scans.length - 1)];
      return reply(200, body);
    }
    return reply(404, { error: { code: 'NOT_FOUND', message: 'nope' } });
  });
  return fn;
}

export { reply };
