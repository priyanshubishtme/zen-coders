import { contrastRatio } from './contrast.js';

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** #rgb, #rrggbb and rgb()/rgba() to #rrggbb, or null. */
export function normalizeHex(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`;
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(v);
  return m ? `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}` : null;
}

/** Required ratio from axe's "4.5:1" text, or 4.5. */
export const requiredRatio = (expected) => Number.parseFloat(expected ?? '') || 4.5;

/**
 * The closest text color that reaches the required ratio on this background,
 * found by stepping the original toward black or white. A suggestion, never applied.
 * @returns {{ color: string, ratio: number } | null}
 */
export function suggestForeground(fg, bg, min = 4.5) {
  const f = normalizeHex(fg);
  const b = normalizeHex(bg);
  if (!f || !b) return null;
  if (contrastRatio(f, b) >= min) return { color: f, ratio: contrastRatio(f, b) };
  const [r, g, bl] = toRgb(f);
  const candidates = [];
  for (const target of [0, 255]) {
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const c = `#${hex2(r + (target - r) * t)}${hex2(g + (target - g) * t)}${hex2(bl + (target - bl) * t)}`;
      const ratio = contrastRatio(c, b);
      if (ratio >= min) {
        candidates.push({ color: c, ratio, t });
        break;
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, c) => a.t - c.t);
  return { color: candidates[0].color, ratio: candidates[0].ratio };
}

/**
 * One row per distinct failing color pair. Uses only colors the scan stored.
 * @param {import('./api.js').Violation[]} violations
 */
export function colorPairs(violations) {
  const byPair = new Map();
  for (const v of violations ?? []) {
    const e = v.node?.evidence;
    const fg = normalizeHex(e?.fgColor);
    const bg = normalizeHex(e?.bgColor);
    if (!fg || !bg) continue;
    const key = `${fg}|${bg}`;
    const row = byPair.get(key);
    if (row) {
      row.ids.push(v.id);
      continue;
    }
    const min = requiredRatio(e.expectedContrastRatio);
    byPair.set(key, {
      key,
      fg,
      bg,
      ratio: e.contrastRatio ?? contrastRatio(fg, bg),
      min,
      fontSize: e.fontSize,
      fontWeight: e.fontWeight,
      ids: [v.id],
      suggestion: suggestForeground(fg, bg, min),
    });
  }
  return [...byPair.values()];
}
