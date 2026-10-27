import { describe, expect, it } from 'vitest';
import { colorPairs, normalizeHex, suggestForeground } from './colorFix.js';
import { contrastRatio } from './contrast.js';

describe('colorFix', () => {
  it('normalizes the color formats axe reports', () => {
    expect(normalizeHex('#AbC')).toBe('#aabbcc');
    expect(normalizeHex('rgb(119, 119, 119)')).toBe('#777777');
    expect(normalizeHex('not a color')).toBeNull();
  });

  it('suggests the nearest passing text color', () => {
    const s = suggestForeground('#999999', '#ffffff', 4.5);
    expect(s.ratio).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s.color, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(s.color).not.toBe('#000000');
  });

  it('only builds rows when both colors are stored', () => {
    const rows = colorPairs([
      { id: 'a', node: { evidence: { fgColor: '#999999', bgColor: '#ffffff', contrastRatio: 2.85, expectedContrastRatio: '4.5:1' } } },
      { id: 'b', node: { evidence: { fgColor: '#999999', bgColor: '#ffffff', contrastRatio: 2.85, expectedContrastRatio: '4.5:1' } } },
      { id: 'c', node: { evidence: { fgColor: '#999999', bgColor: null } } },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].ids).toEqual(['a', 'b']);
  });
});
