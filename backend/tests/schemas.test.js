import { describe, expect, it } from 'vitest';
import { CreateScanBody, IMPACT_WEIGHTS, Repair, Score, Violation } from '../src/schemas/index.js';
import { axeTags } from '../src/services/scanner/index.js';

const violation = {
  id: 'v1',
  ruleId: 'image-alt',
  source: 'axe',
  outcome: 'violation',
  category: 'wcag',
  impact: 'critical',
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
  title: 'Image has no text alternative',
  explanation: 'Screen reader users hear nothing useful for this image.',
  whoItAffects: 'Blind and low-vision people using screen readers',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
  node: { target: ['img.hero'], html: '<img class="hero" src="a.jpg">', failureSummary: null },
  signature: 'image-alt:abc123',
  status: 'open',
};

describe('contracts', () => {
  it('accepts a well-formed Violation', () => {
    expect(Violation.safeParse(violation).success).toBe(true);
  });

  it('rejects a Violation with a malformed WCAG criterion', () => {
    const bad = { ...violation, wcag: { ...violation.wcag, criteria: ['1.1'] } };
    expect(Violation.safeParse(bad).success).toBe(false);
  });

  it('allows a manual Repair with no patch', () => {
    const repair = {
      id: 'r1',
      violationId: 'v1',
      ruleId: 'video-caption',
      strategy: 'manual',
      status: 'manual-review',
      confidence: 'low',
      patch: null,
      rationale: 'Captions need a human transcript.',
      notes: ['Write captions for every spoken word.'],
      needsHumanInput: true,
      placeholder: null,
      tokenUsage: null,
      verification: null,
      createdAt: new Date().toISOString(),
    };
    expect(Repair.safeParse(repair).success).toBe(true);
  });

  it('represents "no applicable rules" as a null score', () => {
    const zero = { fail: 0, pass: 0 };
    const score = {
      value: null,
      formulaVersion: 1,
      standard: 'WCAG 2.2 AA',
      rulesChecked: 0,
      elementsChecked: 0,
      failingElements: 0,
      weightedFailures: 0,
      weightedTotal: 0,
      byImpact: { critical: zero, serious: zero, moderate: zero, minor: zero },
      rules: [],
      manualReviewCount: 0,
      advisoryCount: 0,
      engine: { axeVersion: '4.14.0' },
    };
    expect(Score.safeParse(score).success).toBe(true);
  });

  it('defaults scan options to AA with best practices as advisory', () => {
    const body = CreateScanBody.parse({ input: { type: 'html', html: '<p>x</p>' } });
    expect(body.options).toEqual({
      includeAAA: false,
      includeBestPractice: true,
      crawl: false,
      keyboard: true,
    });
  });

  it('only accepts http(s) URLs', () => {
    const r = CreateScanBody.safeParse({ input: { type: 'url', url: 'file:///etc/passwd' } });
    expect(r.success).toBe(false);
  });

  it('pins the agreed impact weights', () => {
    expect(IMPACT_WEIGHTS).toEqual({ critical: 10, serious: 7, moderate: 3, minor: 1 });
  });

  it('targets WCAG 2.2 AA by default and adds AAA only on request', () => {
    const aa = axeTags({ includeAAA: false, includeBestPractice: false });
    expect(aa).toContain('wcag22aa');
    expect(aa.some((t) => t.endsWith('aaa'))).toBe(false);
    expect(axeTags({ includeAAA: true, includeBestPractice: false })).toContain('wcag22aaa');
  });
});
