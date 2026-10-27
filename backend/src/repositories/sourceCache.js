/**
 * Short-lived, memory-only store of what repairs need: the scanned source
 * text and the responses captured for offline replay. Deliberately NOT part
 * of ScanRepository: it is never written to a database, and entries expire.
 *
 * @param {{ ttlMs?: number, maxEntries?: number, now?: () => number }} [opts]
 */
export function createSourceCache({ ttlMs = 60 * 60 * 1000, maxEntries = 100, now = Date.now } = {}) {
  const entries = new Map();

  return {
    ttlMs,
    /** @param {string} scanId @param {{ source: string, resources: Map, mainUrl: string | null }} value */
    set(scanId, value) {
      entries.delete(scanId);
      entries.set(scanId, { value, expiresAt: now() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    },
    get(scanId) {
      const e = entries.get(scanId);
      if (!e) return null;
      if (e.expiresAt <= now()) {
        entries.delete(scanId);
        return null;
      }
      return e.value;
    },
  };
}
