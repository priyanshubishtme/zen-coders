import { describe, expect, it } from 'vitest';
import { buildReport, reportToHtml } from '../src/services/report/index.js';

const poison = '<script>alert(1)</script><img src=x onerror=alert(1)>';

describe('HTML report escaping', () => {
  it('renders malicious snippets inert', () => {
    const report = buildReport({
      scan: {
        id: 's_testhtmlxss00123456789',
        input: { type: 'html', bytes: 12 },
        page: { title: poison, finalUrl: null, settled: true },
        score: { value: 0 },
        violations: [
          {
            title: poison,
            ruleId: 'image-alt',
            impact: 'critical',
            node: { html: poison },
          },
        ],
        manualReview: [],
        advisory: [],
        tokenUsage: null,
      },
      repairs: [
        {
          ruleId: 'image-alt',
          strategy: 'template',
          status: 'needs-input',
          rationale: poison,
          patch: { diff: poison },
        },
      ],
      verification: null,
    });
    const html = reportToHtml(report);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
  });
});
