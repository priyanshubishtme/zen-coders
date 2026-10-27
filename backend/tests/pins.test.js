import { describe, expect, it } from 'vitest';
import { frameKey, mainSelector, marksFor, rectToPin } from '../src/services/scanner/pins.js';

const view = { width: 1280, height: 720 };

describe('rectToPin', () => {
  it('stores a box as fractions of the viewport', () => {
    expect(rectToPin({ x: 128, y: 72, width: 640, height: 360 }, view)).toEqual({
      place: 'pin',
      x: 0.1,
      y: 0.1,
      w: 0.5,
      h: 0.5,
    });
  });

  it('clips a box that hangs off the viewport', () => {
    const pin = rectToPin({ x: -10, y: 0, width: 30, height: 20 }, view);
    expect(pin.place).toBe('pin');
    expect(pin.x).toBe(0);
    expect(pin.w).toBeCloseTo(20 / 1280);
  });

  it('marks a node below the fold as off-screen', () => {
    expect(rectToPin({ x: 0, y: 800, width: 40, height: 20 }, view).place).toBe('offscreen');
  });

  it('marks a missing rect as unmeasured', () => {
    expect(rectToPin(null, view).place).toBe('unmeasured');
  });
});

describe('selectors', () => {
  it('refuses iframe hops and shadow selectors', () => {
    expect(mainSelector([['iframe', 'img']])).toBeNull();
    expect(mainSelector([['div', 'span']])).toBeNull();
    expect(mainSelector(['img.hero'])).toBe('img.hero');
  });

  it('numbers only in-view violations, in order', () => {
    const frames = [
      { key: frameKey('image-alt', ['img']), place: 'pin', x: 0.1, y: 0.2, w: 0.3, h: 0.1, name: '', role: 'img' },
      { key: frameKey('label', ['input']), place: 'offscreen', name: 'Email', role: 'input' },
    ];
    const marks = marksFor(
      [
        { id: 'v1', ruleId: 'image-alt', node: { target: ['img'] } },
        { id: 'v2', ruleId: 'label', node: { target: ['input'] } },
      ],
      frames,
    );
    expect(marks.map((m) => [m.violationId, m.n, m.place])).toEqual([
      ['v1', 1, 'pin'],
      ['v2', null, 'offscreen'],
    ]);
  });
});
