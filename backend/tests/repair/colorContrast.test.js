import { describe, expect, it } from 'vitest';
import { contrast, fixContrast, parseHex } from '../../src/services/repair/color.js';
import * as fixer from '../../src/services/repair/rules/colorContrast.js';
import { run, violation } from './helpers.js';

const evidence = (fg, bg = '#ffffff', expected = '4.5:1') => ({
  fgColor: fg,
  bgColor: bg,
  contrastRatio: 2,
  expectedContrastRatio: expected,
  fontSize: '12pt',
  fontWeight: 'normal',
});

describe('fixContrast', () => {
  it.each([
    ['#b0b0b0', '#ffffff', 4.52],
    ['#ff6b6b', '#ffffff', 4.52],
    ['#6b8cff', '#ffffff', 3.02],
    ['#555555', '#000000', 4.52],
    ['#3366cc', '#223355', 4.52],
  ])('%s on %s reaches %s', (fg, bg, target) => {
    const fix = fixContrast(fg, bg, target);
    expect(fix).not.toBeNull();
    expect(contrast(parseHex(fix.hex), parseHex(bg))).toBeGreaterThanOrEqual(target);
  });

  it('changes as little as possible: the result sits just above the target', () => {
    const fix = fixContrast('#b0b0b0', '#ffffff', 4.52);
    expect(fix.ratio).toBeLessThan(4.7);
  });

  it('keeps greys pure grey', () => {
    expect(fixContrast('#b0b0b0', '#ffffff', 4.52).hex).toBe('#767676');
  });

  it('keeps a red red (hue preserved)', () => {
    const [r, g, b] = parseHex(fixContrast('#ff6b6b', '#ffffff', 4.52).hex);
    expect(r).toBeGreaterThan(g * 1.5);
    expect(r).toBeGreaterThan(b * 1.5);
  });
});

describe('color-contrast repair', () => {
  const page = (css, body) => `<html><head><style>${css}</style></head><body>${body}</body></html>`;

  it('edits the one <style> rule that owns the colour', () => {
    const src = page('.muted { color: #b0b0b0; }', '<p class="muted">Hi</p>');
    const { p, after } = run(fixer, src, violation('color-contrast', '.muted', { node: { evidence: evidence('#b0b0b0') } }));
    expect(p).toMatchObject({ strategy: 'deterministic', confidence: 'high' });
    expect(after).toBe(src.replace('#b0b0b0', '#767676'));
    expect(p.explanation).toMatch(/2\.\d+:1 to 4\.5\d:1/);
  });

  it('edits an existing inline colour in place', () => {
    const src = page('', '<p style="margin: 0; color: #aaa">Hi</p>');
    const { after } = run(fixer, src, violation('color-contrast', 'p', { node: { evidence: evidence('#aaaaaa') } }));
    expect(after).toContain('style="margin: 0; color: #');
    expect(after).not.toContain('#aaa"');
  });

  it('falls back to an inline colour when no single rule owns it', () => {
    const src = page('body { color: #b0b0b0 }', '<p class="x">Hi</p>');
    const { p, after } = run(fixer, src, violation('color-contrast', '.x', { node: { evidence: evidence('#b0b0b0') } }));
    expect(p.confidence).toBe('medium');
    expect(after).toContain('<p class="x" style="color: #767676">');
  });

  it('sends unmeasurable colours to manual review', () => {
    const src = page('', '<p>Hi</p>');
    expect(run(fixer, src, violation('color-contrast', 'p')).p).toMatchObject({ kind: 'manual' });
    const alpha = violation('color-contrast', 'p', { node: { evidence: evidence('#b0b0b080') } });
    expect(run(fixer, src, alpha).p.reason).toMatch(/semi-transparent/);
  });

  it('sends elements that are not in the source to manual review', () => {
    const src = page('', '<p>Hi</p>');
    const v = violation('color-contrast', '.rendered-by-js', { node: { evidence: evidence('#b0b0b0') } });
    expect(run(fixer, src, v).p.reason).toMatch(/JavaScript/);
  });
});
