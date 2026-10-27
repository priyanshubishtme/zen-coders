import { describe, expect, it } from 'vitest';
import { Score } from '../src/schemas/index.js';
import { computeScore } from '../src/services/scorer/index.js';
import { weightOf } from '../src/services/scorer/weights.js';

const TAGS = {
  'image-alt': ['wcag2a', 'wcag111'],
  'color-contrast': ['wcag2aa', 'wcag143'],
  label: ['wcag2a', 'wcag412'],
  'html-has-lang': ['wcag2a', 'wcag311'],
  'document-title': ['wcag2a', 'wcag242'],
  'heading-order': ['best-practice'],
};
const nodes = (n, impact = 'minor') => Array.from({ length: n }, () => ({ impact }));

/** Build an axe-shaped raw result from { ruleId: [pass, fail] }. */
function raw(counts, extra = {}) {
  const entries = Object.entries(counts);
  return {
    axeVersion: '4.14.0',
    violations: entries.filter(([, [, f]]) => f).map(([id, [, f]]) => ({ id, tags: TAGS[id], nodes: nodes(f) })),
    passes: entries.filter(([, [p]]) => p).map(([id, [p]]) => ({ id, tags: TAGS[id], count: p })),
    incomplete: [],
    findings: [],
    ...extra,
  };
}

// docs/06-scoring-spec.md, "Worked example"
const WORKED = {
  'image-alt': [6, 4],
  'color-contrast': [30, 10],
  label: [2, 1],
  'html-has-lang': [0, 1],
  'document-title': [1, 0],
};

describe('computeScore (formula version 1)', () => {
  it('reproduces the worked example in doc 06: 127 / 424 -> 70', () => {
    const s = computeScore(raw(WORKED));
    expect(s).toMatchObject({ weightedFailures: 127, weightedTotal: 424, value: 70, rulesChecked: 5 });
    expect(Score.safeParse(s).success).toBe(true);
  });

  it('reproduces the doc 06 "after" figure: 10 / 424 -> 98', () => {
    const s = computeScore(
      raw({ 'image-alt': [9, 1], 'color-contrast': [40, 0], label: [3, 0], 'html-has-lang': [1, 0], 'document-title': [1, 0] }),
    );
    expect(s).toMatchObject({ weightedFailures: 10, weightedTotal: 424, value: 98 });
  });

  it('uses the fixed rule weight, never the per-node impact', () => {
    const s = computeScore(raw({ 'image-alt': [0, 1] }));
    expect(s.rules[0]).toMatchObject({ weight: 10, impact: 'critical' });
    expect(weightOf('some-unknown-rule')).toBe(3);
  });

  it('returns null ("N/A") when no rule applied, never 100', () => {
    expect(computeScore(raw({})).value).toBeNull();
  });

  it('never shows 100 while anything fails', () => {
    expect(computeScore(raw({ 'image-alt': [999, 0], 'html-has-lang': [0, 0], label: [5000, 1] })).value).toBe(99);
  });

  it('rounds half up', () => {
    // 1 - 7/20 = 0.65 -> 65 ; 1 - 7/16 = 56.25 -> 56 ; 1 - 7/56 = 87.5 -> 88
    expect(computeScore(raw({ 'color-contrast': [1, 1] })).value).toBe(50);
    expect(computeScore(raw({ 'color-contrast': [7, 1] })).value).toBe(88);
  });

  it('keeps best practices, our checks and needs-review out of the score', () => {
    const base = computeScore(raw(WORKED));
    const noisy = computeScore(
      raw(
        { ...WORKED, 'heading-order': [0, 5] },
        { incomplete: [{ id: 'color-contrast', tags: TAGS['color-contrast'], nodes: nodes(3) }], findings: [{ ruleId: 'afx-link-ambiguous' }] },
      ),
    );
    expect(noisy.value).toBe(base.value);
    expect(noisy).toMatchObject({ manualReviewCount: 3, advisoryCount: 6 });
  });

  it('reports per-severity counts', () => {
    const s = computeScore(raw(WORKED));
    expect(s.byImpact.critical).toEqual({ pass: 8, fail: 5 });
    expect(s.byImpact.serious).toEqual({ pass: 31, fail: 11 });
  });
});
