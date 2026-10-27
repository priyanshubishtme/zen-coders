const KEY = 'accessfix.history.v1';

export function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

/** Keep this browser's scan ids. Server has no global list. */
export function rememberScan(entry) {
  const next = [entry, ...loadHistory().filter((e) => e.id !== entry.id)].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
