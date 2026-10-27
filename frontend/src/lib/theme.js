const KEY = 'accessfix.theme';
const MODES = ['system', 'light', 'dark'];

export function readTheme() {
  const fromQuery = new URLSearchParams(window.location.search).get('theme');
  if (MODES.includes(fromQuery)) return fromQuery;
  const stored = window.localStorage.getItem(KEY);
  return MODES.includes(stored) ? stored : 'system';
}

/** Apply a theme for this page. A `?theme=` value is not written to storage. */
export function applyTheme(mode) {
  const resolved = MODES.includes(mode) ? mode : 'system';
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = resolved === 'dark' || (resolved === 'system' && Boolean(systemDark));
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

/** Remember a choice the person made with the theme control. */
export function saveTheme(mode) {
  window.localStorage.setItem(KEY, mode);
  return applyTheme(mode);
}
