/** Viewport used for the scan and for both screenshots, so pins and the slider share one frame. */
export const SCAN_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

/**
 * Turn a CSS pixel rect into a fraction of the viewport, or say why there is no pin.
 * @param {{ x: number, y: number, width: number, height: number } | null | undefined} rect
 * @param {{ width: number, height: number }} view
 * @returns {{ place: 'pin', x: number, y: number, w: number, h: number } | { place: 'offscreen' | 'unmeasured' }}
 */
export function rectToPin(rect, view) {
  if (!rect || rect.width < 1 || rect.height < 1) return { place: 'unmeasured' };
  const { x, y, width, height } = rect;
  if (x + width <= 0 || y + height <= 0 || x >= view.width || y >= view.height) return { place: 'offscreen' };
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(view.width, x + width);
  const y1 = Math.min(view.height, y + height);
  return {
    place: 'pin',
    x: x0 / view.width,
    y: y0 / view.height,
    w: (x1 - x0) / view.width,
    h: (y1 - y0) / view.height,
  };
}

/** axe target → the same string parts the normalizer stores on a violation. */
export function targetParts(target) {
  return (target ?? []).map((part) => (Array.isArray(part) ? part.join(' >>> ') : String(part)));
}

export function frameKey(ruleId, target) {
  return `${ruleId}\n${targetParts(target).join('\n')}`;
}

/** A selector we can resolve in the top document. Frames and shadow roots return null. */
export function mainSelector(target) {
  const parts = targetParts(target);
  if (parts.length !== 1) return null;
  if (parts[0].includes(' >>> ')) return null;
  return parts[0];
}

/**
 * Number the violations that landed inside the viewport. Everyone else is recorded
 * without a pin so the card can say why.
 * @param {{ id: string, ruleId: string, node: { target: string[] } }[]} violations
 * @param {{ key: string, place: string, x?: number, y?: number, w?: number, h?: number, name?: string, role?: string }[]} frames
 */
export function marksFor(violations, frames) {
  const byKey = new Map(frames.map((frame) => [frame.key, frame]));
  let n = 0;
  const marks = [];
  for (const violation of violations) {
    const frame = byKey.get(frameKey(violation.ruleId, violation.node.target));
    if (!frame || frame.place === 'unmeasured') continue;
    const base = {
      violationId: violation.id,
      name: (frame.name ?? '').slice(0, 200),
      role: (frame.role ?? '').slice(0, 40),
      place: frame.place,
    };
    if (frame.place === 'pin') {
      n += 1;
      marks.push({ ...base, n, x: frame.x, y: frame.y, w: frame.w, h: frame.h });
    } else {
      marks.push({ ...base, n: null, x: null, y: null, w: null, h: null });
    }
  }
  return marks;
}
