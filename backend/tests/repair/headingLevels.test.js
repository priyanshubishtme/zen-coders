import { describe, expect, it } from 'vitest';
import * as fixer from '../../src/services/repair/rules/headingLevels.js';
import { run, scanStub, violation } from './helpers.js';

describe('heading-order repair', () => {
  it('re-levels the skipped heading and keeps its look with a class', () => {
    const src = '<head></head><body><h1>A</h1><h3>B</h3><p>x</p></body>';
    const { p, after } = run(fixer, src, violation('heading-order', 'h3'));
    expect(after).toContain('<h2 class="afx-h3">B</h2>');
    expect(after).toContain('<style data-accessfix>\n.afx-h3{font-size:1.17em;font-weight:700;');
    expect(p.confidence).toBe('medium');
  });

  it('uses the computed style from the scan when available', () => {
    const scan = scanStub({
      headingOutline: [
        { level: 3, text: 'B', target: ['h3'], style: { fontSize: '22px', fontWeight: '600', marginTop: '4px', marginBottom: '8px' } },
      ],
    });
    const { after } = run(fixer, '<h1>A</h1><h3>B</h3>', violation('heading-order', 'h3'), scan);
    expect(after).toContain('.afx-h3{font-size:22px;font-weight:600;margin-top:4px;margin-bottom:8px}');
  });

  it('moves the headings nested under it by the same amount', () => {
    const src = '<h1>A</h1><h4 class="t">B</h4><h5>C</h5><h2>D</h2>';
    const { p, after } = run(fixer, src, violation('heading-order', 'h4'));
    expect(after).toContain('<h2 class="t afx-h4">B</h2><h3 class="afx-h5">C</h3><h2>D</h2>');
    expect(p.explanation).toMatch(/re-levels the 1 heading under it/);
  });

  it('demotes an extra h1 to h2', () => {
    const { after } = run(fixer, '<h1>A</h1><h1>B</h1>', violation('afx-heading-multiple-h1', 'h1:nth-of-type(2)'));
    expect(after).toContain('<h1>A</h1><h2 class="afx-h1">B</h2>');
  });

  it('sends ARIA headings to manual review (native tags only)', () => {
    const { p } = run(fixer, '<div role="heading" aria-level="4">X</div>', violation('heading-order', 'div'));
    expect(p.kind).toBe('manual');
  });
});
