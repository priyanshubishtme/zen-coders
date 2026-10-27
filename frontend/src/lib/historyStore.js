const KEY = 'accessfix.history.v1';

export function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

/** Add fields to a remembered scan, such as the score after verified fixes. */
export function updateHistory(id, patch) {
  const list = loadHistory();
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: history is a convenience */
  }
  return next;
}

/** Keep this browser's scan ids. Server has no global list. */
export function rememberScan(entry) {
  const next = [entry, ...loadHistory().filter((e) => e.id !== entry.id)].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
