/**
 * Colour maths for contrast repairs: WCAG 2.x contrast plus OKLCH so we can
 * change lightness while keeping hue (and as much chroma as the sRGB gamut allows).
 */

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export const toHex = (rgb) =>
  `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance(rgb) {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toOklch(rgb) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function fromOklchRaw([L, C, h]) {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);

/** OKLCH -> sRGB, reducing chroma (keeping L and hue) until it fits the gamut. */
function fromOklch([L, C, h]) {
  let lo = 0;
  let hi = C;
  if (inGamut(fromOklchRaw([L, C, h]))) return fromOklchRaw([L, C, h]).map(gam);
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(fromOklchRaw([L, mid, h]))) lo = mid;
    else hi = mid;
  }
  return fromOklchRaw([L, lo, h]).map((c) => gam(Math.min(1, Math.max(0, c))));
}

/**
 * Smallest lightness change to `fg` (hue kept) that reaches `target` contrast
 * against `bg`. Returns null if neither darker nor lighter can get there.
 * @returns {{ hex: string, ratio: number } | null}
 */
export function fixContrast(fgHex, bgHex, target) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return null;
  const [L, rawC, h] = toOklch(fg);
  // Greys have no meaningful hue; keep them pure grey instead of drifting.
  const C = rawC < 0.01 ? 0 : rawC;

  const tryDirection = (dir) => {
    const end = dir < 0 ? 0 : 1;
    const at = (l) => parseHex(toHex(fromOklch([l, C, h])));
    if (contrast(at(end), bg) < target) return null;
    let near = L;
    let far = end;
    for (let i = 0; i < 40; i += 1) {
      const mid = (near + far) / 2;
      if (contrast(at(mid), bg) >= target) far = mid;
      else near = mid;
    }
    // Step outward on the 8-bit grid until the rounded hex really passes.
    let l = far;
    for (let i = 0; i < 50 && contrast(at(l), bg) < target; i += 1) l += dir * 0.002;
    const rgb = at(l);
    return { hex: toHex(rgb), ratio: contrast(rgb, bg), delta: Math.abs(l - L) };
  };

  const darker = tryDirection(-1);
  const lighter = tryDirection(1);
  const best = [darker, lighter].filter(Boolean).sort((a, b) => a.delta - b.delta)[0];
  return best ? { hex: best.hex, ratio: best.ratio } : null;
}
