import { describe, expect, it } from 'vitest';
import { Violation } from '../src/schemas/index.js';
import { normalize } from '../src/services/scanner/normalize.js';
import { normalizePattern, patternSignature } from '../src/services/scanner/signature.js';

const axeRule = (id, tags, nodes, extra = {}) => ({
  id,
  tags,
  impact: 'serious',
  help: `${id} help`,
  description: `${id} description`,
  helpUrl: `https://dequeuniversity.com/rules/axe/4.14/${id}?application=playwright`,
  nodes,
  ...extra,
});
const node = (target, html, afxId, impact) => ({
  target,
  html,
  afxId,
  impact,
  failureSummary: 'Fix it',
});

const raw = {
  violations: [
    axeRule(
      'color-contrast',
      ['cat.color', 'wcag2aa', 'wcag143'],
      [node(['.muted'], '<p class="muted">Hi</p>', 3, 'serious')],
    ),
    axeRule(
      'heading-order',
      ['cat.semantics', 'best-practice'],
      [node(['h3'], '<h3>X</h3>', 7, 'moderate')],
    ),
    axeRule('made-up-rule', ['cat.forms', 'wcag2a', 'wcag412'], [node(['input'], '<input>', 9)]),
  ],
  incomplete: [
    axeRule(
      'color-contrast',
      ['cat.color', 'wcag2aa', 'wcag143'],
      [node(['.hero'], '<p class="hero">x</p>', 4)],
    ),
  ],
  findings: [
    {
      ruleId: 'afx-heading-skip',
      impact: 'moderate',
      afxId: 7,
      target: ['h3'],
      html: '<h3>X</h3>',
      failureSummary: 's',
      overlaps: ['heading-order'],
    },
    {
      ruleId: 'afx-heading-skip',
      impact: 'moderate',
      afxId: 8,
      target: ['h5'],
      html: '<h5>Y</h5>',
      failureSummary: 's',
      overlaps: ['heading-order'],
    },
    {
      ruleId: 'afx-link-ambiguous',
      impact: 'moderate',
      afxId: 11,
      target: [['my-card', 'a']],
      html: '<a href="/x">More</a>',
      failureSummary: 's',
      overlaps: [],
    },
  ],
};

describe('normalize', () => {
  const out = normalize(raw, { inputHash: 'abc' });

  it('splits WCAG violations, advisory and manual review', () => {
    expect(out.violations.map((v) => v.ruleId)).toEqual(['color-contrast', 'made-up-rule']);
    expect(out.advisory.map((v) => v.ruleId)).toEqual([
      'heading-order',
      'afx-heading-skip',
      'afx-link-ambiguous',
    ]);
    expect(out.manualReview.map((v) => v.ruleId)).toEqual(['color-contrast']);
    expect(out.manualReview[0]).toMatchObject({ outcome: 'needs-review', status: 'manual-review' });
  });

  it('merges our finding into axe when both flag the same element', () => {
    const skips = out.advisory.filter((v) => v.ruleId === 'afx-heading-skip');
    expect(skips).toHaveLength(1);
    expect(skips[0].node.target).toEqual(['h5']);
  });

  it('produces contract-valid violations with plain language and WCAG refs', () => {
    for (const v of [...out.violations, ...out.advisory, ...out.manualReview]) {
      expect(Violation.safeParse(v).success, v.ruleId).toBe(true);
    }
    const contrast = out.violations[0];
    expect(contrast.title).toBe('Text has low contrast against its background');
    expect(contrast.whoItAffects).toMatch(/low vision/);
    expect(contrast.wcag).toMatchObject({ criteria: ['1.4.3'], level: 'AA' });
    expect(contrast.wcag.refs[0]).toMatchObject({ name: 'Contrast (Minimum)' });
    expect(contrast.helpUrl).not.toContain('?');
  });

  it('falls back to axe text and category for rules without a template', () => {
    const v = out.violations[1];
    expect(v.title).toBe('made-up-rule help');
    expect(v.whoItAffects).toMatch(/voice-control/);
    expect(v.impact).toBe('serious');
  });

  it('joins shadow-DOM target paths', () => {
    const link = out.advisory.find((v) => v.ruleId === 'afx-link-ambiguous');
    expect(link.node.target).toEqual(['my-card >>> a']);
    expect(link.wcag.criteria).toEqual(['2.4.4']);
  });

  it('gives stable ids for the same input and different ids for different input', () => {
    const again = normalize(raw, { inputHash: 'abc' });
    const other = normalize(raw, { inputHash: 'xyz' });
    expect(again.violations.map((v) => v.id)).toEqual(out.violations.map((v) => v.id));
    expect(other.violations[0].id).not.toBe(out.violations[0].id);
  });

  it('separates the same rule on the same element by outcome', () => {
    const ids = new Set([...out.violations, ...out.manualReview].map((v) => v.id));
    expect(ids.size).toBe(out.violations.length + out.manualReview.length);
  });
});

describe('pattern signature', () => {
  it('groups elements that differ only by id, class, data-* or digits', () => {
    const a =
      '<a href="/products/123/share" id="s1" class="btn x" data-k="1"><i class="icon-share"></i></a>';
    const b =
      '<a href="/products/987/share" id="s2" class="btn y" data-k="2"><i class="icon-share"></i></a>';
    expect(patternSignature('link-name', a)).toBe(patternSignature('link-name', b));
  });

  it('separates different patterns and different rules', () => {
    const a = '<img src="/img/hero.jpg">';
    const b = '<img src="/img/logo.svg">';
    expect(patternSignature('image-alt', a)).not.toBe(patternSignature('image-alt', b));
    expect(patternSignature('image-alt', a)).not.toBe(patternSignature('role-img-alt', a));
  });

  it('keeps identity attributes in sorted order', () => {
    expect(
      normalizePattern('<input type="email" name="email" placeholder="You@x.com" class="f">'),
    ).toBe('input|name=email|placeholder=you@x.com|type=email|');
  });
});
