import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { insertAt } from '../src/services/repair/edits.js';
import { compare } from '../src/services/verifier/compare.js';
import { createVerifier } from '../src/services/verifier/index.js';

const rawOf = (violations, findings = []) => ({ axeVersion: '4', violations, incomplete: [], passes: [], findings });
const node = (html, marker = null) => ({ html, marker, target: ['x'] });

describe('compare', () => {
  it('matches marked elements by marker even when their markup changed', () => {
    const before = rawOf([{ id: 'label', tags: [], nodes: [node('<input>', '0')] }]);
    const after = rawOf([{ id: 'label', tags: [], nodes: [node('<input id="a">', '0')] }]);
    const d = compare(before, after);
    expect(d.resolved).toHaveLength(0);
    expect(d.remaining).toHaveLength(1);
  });

  it('matches unmarked elements by opening tag, ignoring markers and children', () => {
    const before = rawOf([{ id: 'region', tags: [], nodes: [node('<main><p data-afx-v="1">a</p></main>')] }]);
    const after = rawOf([{ id: 'region', tags: [], nodes: [node('<main><label>x</label><p>a</p></main>')] }]);
    expect(compare(before, after).regressions).toHaveLength(0);
  });

  it('counts repeated identical elements as a multiset', () => {
    const before = rawOf([{ id: 'image-alt', tags: [], nodes: [node('<img>'), node('<img>')] }]);
    const after = rawOf([{ id: 'image-alt', tags: [], nodes: [node('<img>'), node('<img>'), node('<img>')] }]);
    expect(compare(before, after).regressions).toHaveLength(1);
  });

  it('includes our own findings', () => {
    const before = rawOf([], [{ ruleId: 'afx-link-ambiguous', html: '<a>', marker: '2' }]);
    expect(compare(before, rawOf([])).resolved.map((i) => i.ruleId)).toEqual(['afx-link-ambiguous']);
  });
});

/**
 * Fake scanner: every <div data-afx-v> without class "ok" is a "demo" violation;
 * any element with class "bad" is a NEW unmarked violation (a regression).
 */
function fakeScanner() {
  const calls = [];
  return {
    calls,
    async scan(input, _opts, hooks) {
      calls.push(hooks);
      const $ = cheerio.load(input.html);
      const demo = $('div[data-afx-v]:not(.ok)').toArray().map((el) => node($.html(el), el.attribs['data-afx-v']));
      const bad = $('.bad').toArray().map((el) => node($.html(el)));
      return rawOf([
        { id: 'demo', tags: [], nodes: demo },
        { id: 'other', tags: [], nodes: bad },
      ]);
    },
  };
}

const SOURCE = '<div id="a"></div><div id="b"></div><div id="c"></div><div id="d"></div>';
const at = (id) => SOURCE.indexOf(`id="${id}"`) + `id="${id}"`.length;
const repair = (id, edits) => ({ id, ruleId: 'demo', _markPos: at(id), _css: [], _edits: edits });
const fix = (id) => repair(id, [insertAt(at(id), ' class="ok"')]);

async function verify(repairs, maxScans) {
  const scanner = fakeScanner();
  const verifier = createVerifier({ scanner, maxScans });
  const scan = { input: { type: 'html' }, options: {} };
  const result = await verifier.verify({ scan, cached: { source: SOURCE, resources: new Map(), mainUrl: null }, repairs });
  return { result, scanner, outcome: (id) => result.outcomes.get(id).outcome };
}

describe('verifier', () => {
  it('verifies repairs whose violation disappears, in one combined re-scan, offline', async () => {
    const { result, scanner, outcome } = await verify([fix('a'), fix('b')]);
    expect(outcome('a')).toBe('resolved');
    expect(outcome('b')).toBe('resolved');
    expect(result.scansRun).toBe(2); // baseline + combined
    expect(scanner.calls.every((h) => h.replay)).toBe(true);
    expect(result.patchedHtml).toBe(SOURCE.replace('id="a"', 'id="a" class="ok"').replace('id="b"', 'id="b" class="ok"'));
    expect(result.patchedHtml).not.toContain('data-afx-v');
  });

  it('marks a repair that does not remove its violation as still failing', async () => {
    const { outcome, result } = await verify([repair('a', [insertAt(at('a'), ' title="x"')])]);
    expect(outcome('a')).toBe('still-failing');
    expect(result.applied).toHaveLength(0);
  });

  it('isolates the one repair that causes an unmarked regression by bisection', async () => {
    const culprit = repair('c', [insertAt(at('c'), ' class="ok"'), insertAt(SOURCE.length, '<span class="bad"></span>')]);
    const { outcome, result } = await verify([fix('a'), fix('b'), culprit, fix('d')]);
    expect(outcome('c')).toBe('regressed');
    for (const id of ['a', 'b', 'd']) expect(outcome(id)).toBe('resolved');
    expect(result.applied.map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(result.patchedHtml).not.toContain('bad');
  });

  it('marks conflicting repairs as not applied', async () => {
    const other = repair('a', [insertAt(at('a'), ' class="ok"')]);
    const clash = { ...repair('a', [{ start: 1, end: 4, text: 'span' }]), id: 'clash' };
    const overlapping = { ...repair('a', [{ start: 2, end: 6, text: 'zz' }]), id: 'overlap' };
    const { outcome } = await verify([other, clash, overlapping]);
    expect(outcome('overlap')).toBe('not-applied');
  });

  it('respects the scan budget and blames the whole group when it runs out', async () => {
    const culprit = repair('c', [insertAt(at('c'), ' class="ok"'), insertAt(SOURCE.length, '<span class="bad"></span>')]);
    const { result, outcome } = await verify([fix('a'), fix('b'), culprit, fix('d')], 2);
    expect(result.scansRun).toBe(2);
    expect(outcome('a')).toBe('regressed');
  });
});
