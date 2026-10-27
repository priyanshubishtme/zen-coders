import { describe, expect, it } from 'vitest';
import { applicableRepairs, bandOf, formatScore } from './score.js';

describe('bandOf', () => {
  it('labels the documented bands with icon and text tokens', () => {
    expect(bandOf(null).label).toBe('Nothing to check');
    expect(bandOf(0).label).toBe('Poor');
    expect(bandOf(49).label).toBe('Poor');
    expect(bandOf(50).label).toBe('Needs work');
    expect(bandOf(89).label).toBe('Needs work');
    expect(bandOf(90).label).toBe('Good');
    expect(bandOf(100).label).toBe('Good');
    expect(formatScore(null)).toBe('N/A');
  });
});

describe('applicableRepairs', () => {
  const r = (id, extra) => ({
    id,
    strategy: 'deterministic',
    status: 'verified',
    placeholder: null,
    ...extra,
  });

  it('keeps verified fixes and filled placeholders, never TODO: or manual', () => {
    const repairs = [
      r('a'),
      r('b', { status: 'needs-input', placeholder: 'TODO: x', strategy: 'template' }),
      r('c', { status: 'needs-input', placeholder: 'TODO: y', strategy: 'template' }),
      r('d', { strategy: 'manual', status: 'manual-review' }),
      r('e', { status: 'failed' }),
    ];
    const chosen = applicableRepairs(repairs, { b: 'A loaf of bread', c: 'TODO: still empty' });
    expect(chosen.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('includes an LLM draft only after it is accepted', () => {
    const llm = r('f', {
      strategy: 'llm',
      status: 'needs-input',
      placeholder: 'TODO: describe this image',
      draft: 'A crusty sourdough loaf',
      accepted: false,
    });
    expect(applicableRepairs([llm], { f: 'A crusty sourdough loaf' }).map((x) => x.id)).toEqual([]);
    expect(
      applicableRepairs([llm], { f: 'A crusty sourdough loaf' }, ['f']).map((x) => x.id),
    ).toEqual(['f']);
  });
});
