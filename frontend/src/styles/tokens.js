/**
 * Design tokens: single source of truth. index.css must mirror these values
 * (enforced by tokens.test.js), and every pair in CONTRAST_PAIRS must meet
 * WCAG AA. See docs/08-ux-spec.md#design-tokens.
 *
 * `primary` is the crimson fill for the one main action. Text links use `link`,
 * because crimson text on the navy ground does not reach 4.5:1.
 */
export const TOKENS = {
  light: {
    background: '#f4f6fb',
    surface: '#ffffff',
    raised: '#eef1f8',
    foreground: '#0b1324',
    'muted-foreground': '#4a5571',
    primary: '#c8102e',
    'primary-foreground': '#ffffff',
    link: '#1d4ed8',
    border: '#dde2ec',
    input: '#6b7488',
    ring: '#1d4ed8',
    critical: '#b91c1c',
    serious: '#b3410e',
    moderate: '#8a5300',
    minor: '#1d4ed8',
    verified: '#13733a',
  },
  dark: {
    background: '#07080c',
    surface: '#12141a',
    raised: '#1c1f28',
    foreground: '#f2f4f8',
    'muted-foreground': '#b4b4b4',
    primary: '#dc1f36',
    'primary-foreground': '#ffffff',
    link: '#8fb4ff',
    border: '#2a2e38',
    input: '#949494',
    ring: '#8fb4ff',
    critical: '#ff7b86',
    serious: '#ffa15c',
    moderate: '#f5c542',
    minor: '#8fb4ff',
    verified: '#4ade80',
  },
};

const TEXT = 4.5;
const NON_TEXT = 3;
const SURFACES = ['background', 'surface', 'raised'];
const TEXT_TOKENS = [
  'foreground',
  'muted-foreground',
  'link',
  'critical',
  'serious',
  'moderate',
  'minor',
  'verified',
];

/** [foreground token, background token, minimum ratio] */
export const CONTRAST_PAIRS = [
  ...TEXT_TOKENS.flatMap((t) => SURFACES.map((s) => [t, s, TEXT])),
  ...['input', 'ring', 'primary'].flatMap((t) => SURFACES.map((s) => [t, s, NON_TEXT])),
  ['primary-foreground', 'primary', TEXT],
];
