/**
 * In-memory LRU with TTL. Values are { text, confidence } only — never images.
 * @param {{ ttlMs?: number, maxEntries?: number, now?: () => number }} [opts]
 */
export function createLlmCache({
  ttlMs = 30 * 24 * 60 * 60 * 1000,
  maxEntries = 500,
  now = Date.now,
} = {}) {
  const entries = new Map();

  return {
    get(key) {
      const e = entries.get(key);
      if (!e) return null;
      if (e.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      entries.delete(key);
      entries.set(key, e);
      return e.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    },
    get size() {
      return entries.size;
    },
  };
}
