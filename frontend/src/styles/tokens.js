/**
 * Design tokens: single source of truth. index.css must mirror these values
 * (enforced by tokens.test.js), and every pair in CONTRAST_PAIRS must meet
 * WCAG AA. See docs/08-ux-spec.md#design-tokens.
 */
export const TOKENS = {
  light: {
    background: '#ffffff',
    surface: '#f8fafc',
    foreground: '#0f172a',
    'muted-foreground': '#475569',
    primary: '#0f766e',
    'primary-foreground': '#ffffff',
    border: '#cbd5e1',
    input: '#64748b',
    ring: '#0f766e',
    critical: '#b91c1c',
    serious: '#c2410c',
    moderate: '#a16207',
    minor: '#1d4ed8',
    verified: '#15803d',
  },
  dark: {
    background: '#020617',
    surface: '#0f172a',
    foreground: '#f1f5f9',
    'muted-foreground': '#94a3b8',
    primary: '#2dd4bf',
    'primary-foreground': '#042f2e',
    border: '#334155',
    input: '#64748b',
    ring: '#2dd4bf',
    critical: '#f87171',
    serious: '#fb923c',
    moderate: '#facc15',
    minor: '#60a5fa',
    verified: '#4ade80',
  },
};

const TEXT = 4.5;
const NON_TEXT = 3;
const SURFACES = ['background', 'surface'];
const TEXT_TOKENS = [
  'foreground',
  'muted-foreground',
  'primary',
  'critical',
  'serious',
  'moderate',
  'minor',
  'verified',
];

/** [foreground token, background token, minimum ratio] */
export const CONTRAST_PAIRS = [
  ...TEXT_TOKENS.flatMap((t) => SURFACES.map((s) => [t, s, TEXT])),
  ...['input', 'ring'].flatMap((t) => SURFACES.map((s) => [t, s, NON_TEXT])),
  ['primary-foreground', 'primary', TEXT],
];
