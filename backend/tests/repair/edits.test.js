import { readFileSync } from 'node:fs';
import { applyPatch, reversePatch, structuredPatch } from 'diff';
import { describe, expect, it } from 'vitest';
import { EditConflictError, applyEdits, insertAt, insertBlock, replaceRange } from '../../src/services/repair/edits.js';
import { proposeRepairs } from '../../src/services/repair/index.js';
import { scanStub } from './helpers.js';

const SAMPLE = readFileSync(new URL('../../../samples/broken-sample.html', import.meta.url), 'utf8');

describe('applyEdits', () => {
  it('applies non-overlapping edits and keeps everything else byte-identical', () => {
    expect(applyEdits('<p>hello</p>', [insertAt(2, ' a="1"'), replaceRange(3, 8, 'bye')])).toBe('<p a="1">bye</p>');
  });

  it('merges identical edits from two repairs', () => {
    const e = replaceRange(0, 1, 'X');
    expect(applyEdits('abc', [e, { ...e }])).toBe('Xbc');
  });

  it('rejects overlapping edits', () => {
    expect(() => applyEdits('abcdef', [replaceRange(0, 3, 'x'), replaceRange(2, 4, 'y')])).toThrow(EditConflictError);
  });

  it('puts blocks on their own line before an indented closing tag', () => {
    const src = '<head>\n  </head>';
    expect(applyEdits(src, [insertBlock(src, src.indexOf('</head>'), '<x>')])).toBe('<head>\n<x>\n  </head>');
  });
});

describe('every repair on the sample page is minimal and reversible', () => {
  const sampleScan = scanStub({
    violations: [
      { id: 'v1', ruleId: 'html-has-lang', node: { target: ['html'] } },
      { id: 'v2', ruleId: 'label', node: { target: ['input'] } },
      { id: 'v3', ruleId: 'button-name', node: { target: ['.menu-toggle'] } },
      { id: 'v4', ruleId: 'link-name', node: { target: ['a[href$="cart"]'] } },
      {
        id: 'v5',
        ruleId: 'color-contrast',
        node: { target: ['.muted'], evidence: { fgColor: '#b0b0b0', bgColor: '#ffffff', expectedContrastRatio: '4.5:1' } },
      },
      { id: 'v6', ruleId: 'image-alt', node: { target: ['img'] } },
    ],
    advisory: [{ id: 'v7', ruleId: 'heading-order', node: { target: ['h3'] } }],
  });
  const repairs = proposeRepairs({
    scan: sampleScan,
    source: SAMPLE,
    violations: [...sampleScan.violations, ...sampleScan.advisory],
  });

  it.each(repairs.map((r) => [r.ruleId, r]))('%s', (_id, r) => {
    expect(r.patch).not.toBeNull();
    const after = applyPatch(SAMPLE, r.patch.diff);
    const { hunks } = structuredPatch('a', 'b', SAMPLE, after, '', '', { context: 0 });
    const touched = hunks.reduce((n, h) => n + h.oldLines + h.newLines, 0);
    expect(touched).toBeLessThanOrEqual(12);
    const undo = reversePatch(structuredPatch('index.html', 'index.html', SAMPLE, after));
    expect(applyPatch(after, undo)).toBe(SAMPLE);
    expect(r.patch.copy.startsWith(r.rationale)).toBe(true);
  });
});
