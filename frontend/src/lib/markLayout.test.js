import { describe, expect, it } from 'vitest';
import {
  announcedName,
  buildPreviewModel,
  fixStatus,
  issueScrollTop,
  keyboardSentence,
  placeBadges,
  problemColors,
} from './markLayout.js';

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('placeBadges', () => {
  it('keeps every badge inside the frame and off every box and every other badge', () => {
    const placed = placeBadges([
      { id: 'a', x: 0.02, y: 0.1, w: 0.2, h: 0.12 },
      { id: 'b', x: 0.24, y: 0.1, w: 0.18, h: 0.12 },
      { id: 'c', x: 0.9, y: 0.02, w: 0.08, h: 0.1 },
      { id: 'd', x: 0.05, y: 0.7, w: 0.3, h: 0.15 },
    ]);
    expect(placed).toHaveLength(4);
    for (const item of placed) {
      expect(item.badge.x).toBeGreaterThanOrEqual(0);
      expect(item.badge.y).toBeGreaterThanOrEqual(0);
      expect(item.badge.x + item.badge.w).toBeLessThanOrEqual(1280);
      expect(item.badge.y + item.badge.h).toBeLessThanOrEqual(720);
      expect(overlaps(item.badge, item.box)).toBe(false);
      for (const other of placed) {
        if (other.id === item.id) continue;
        expect(overlaps(item.badge, other.badge)).toBe(false);
        expect(overlaps(item.badge, other.box)).toBe(false);
      }
    }
  });

  it('keeps a badge at least 16px on a smaller preview', () => {
    const [item] = placeBadges([{ id: 'a', x: 0.5, y: 0.5, w: 0.1, h: 0.1 }], undefined, 0.4);
    const css = item.badge.w * 0.4;
    expect(css).toBeGreaterThanOrEqual(16);
    expect(css).toBeLessThanOrEqual(24);
    expect(overlaps(item.badge, item.box)).toBe(false);
  });

  it('moves a badge that would fall off the right edge and still keeps the box', () => {
    const [item] = placeBadges([{ id: 'edge', x: 0.94, y: 0.4, w: 0.05, h: 0.08 }]);
    expect(item.box.w).toBeGreaterThan(0);
    expect(item.badge.x + item.badge.w).toBeLessThanOrEqual(1280);
    expect(item.leader).toBe(true);
  });
});

describe('buildPreviewModel', () => {
  const violation = (id, target) => ({
    id,
    ruleId: 'region',
    impact: 'moderate',
    title: 'Content is outside any landmark',
    explanation: 'Some content is not inside a landmark.',
    node: { target: [target], html: '<p>', failureSummary: null },
  });

  it('numbers boxes in reading order and gives the page a chip', () => {
    const model = buildPreviewModel(
      [
        violation('low', 'p'),
        violation('high', 'a'),
        violation('page', 'html'),
      ],
      [{ ...violation('hand', 'p'), explanation: 'Text sits on a gradient.' }],
      [
        { violationId: 'low', place: 'pin', x: 0.1, y: 0.4, w: 0.2, h: 0.1 },
        { violationId: 'high', place: 'pin', x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
        { violationId: 'page', place: 'pin', x: 0, y: 0, w: 1, h: 1 },
      ],
    );
    expect(model.boxes.map((item) => item.violation.id)).toEqual(['high', 'low']);
    expect(model.boxes.map((item) => item.n)).toEqual([1, 2]);
    expect(model.chips.map((item) => item.violation.id)).toEqual(['page', 'hand']);
    expect(model.numberById.page).toBe(3);
    expect(model.numberById.hand).toBe(4);
    expect(model.chips[1].manual).toBe(true);
  });
});

describe('copy helpers', () => {
  it('fixes the singular keyboard sentence and does not invent a control name', () => {
    expect(keyboardSentence('1 interactive control were not reached by Tab.')).toBe(
      '1 control was not reached by Tab.',
    );
    expect(keyboardSentence('2 interactive controls were not reached by Tab.')).toBe(
      '2 controls were not reached by Tab.',
    );
    expect(keyboardSentence('Tab reached 1 control.')).toBe('Tab reached 1 control.');
  });

  it('truncates a long name and never prints the html element text', () => {
    const long = 'word '.repeat(30);
    const cut = announcedName({ role: 'a', name: long });
    expect(cut.truncated).toBe(true);
    expect(cut.text.length).toBeLessThanOrEqual(81);
    expect(cut.full.length).toBeGreaterThan(80);
    expect(announcedName({ role: 'html', name: 'The entire page text' })).toEqual({
      element: 'Page title / language',
      text: 'Page title / language',
      missing: false,
      truncated: false,
    });
    expect(announcedName({ role: 'button', name: '' }).missing).toBe(true);
  });

  it('does not claim a repair exists before one does, and reports the real outcome after', () => {
    expect(fixStatus('html-has-lang')).toMatch(/Not applied yet/);
    expect(fixStatus('html-has-lang')).not.toMatch(/Applied and verified/);
    expect(fixStatus('color-contrast', { strategy: 'deterministic', status: 'proposed' })).toMatch(/Automatic fix/);
    expect(fixStatus('color-contrast', { strategy: 'deterministic', status: 'proposed' })).toMatch(/has not been applied/);
    expect(fixStatus('image-alt', { strategy: 'llm', status: 'needs-input' })).toMatch(/Draft to review/);
    expect(fixStatus('bypass', { strategy: 'manual', status: 'manual-review' })).toMatch(/Manual fix/);
  });

  it('lists problem colors only when both colors were stored', () => {
    expect(
      problemColors([
        { id: 'a', title: 'Faint', node: { evidence: { fgColor: '#cccccc', bgColor: null } } },
        { id: 'b', title: 'Faint', node: { evidence: { fgColor: '#767676', bgColor: '#ffffff' } } },
      ]),
    ).toEqual([{ id: 'b', title: 'Faint', fg: '#767676', bg: '#ffffff' }]);
  });

  it('computes a pane scroll offset', () => {
    expect(issueScrollTop(100, 340, 20)).toBe(252);
  });
});
