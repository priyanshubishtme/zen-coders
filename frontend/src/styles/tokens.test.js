import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/contrast.js';
import { CONTRAST_PAIRS, TOKENS } from './tokens.js';

// Vitest runs from frontend/; CSS imports are stubbed in tests, so read the file directly.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function cssBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
}

describe.each(Object.keys(TOKENS))('%s theme', (theme) => {
  const t = TOKENS[theme];

  it.each(CONTRAST_PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });

  it('index.css mirrors tokens.js', () => {
    const block = cssBlock(theme === 'light' ? ':root' : '.dark');
    for (const [name, value] of Object.entries(t)) {
      expect(block).toContain(`--${name}: ${value};`);
    }
  });
});

describe('contrastRatio', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
