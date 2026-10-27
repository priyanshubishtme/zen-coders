/**
 * Short-lived, memory-only store of what repairs need: the scanned source
 * text and the responses captured for offline replay. Deliberately NOT part
 * of ScanRepository: it is never written to a database, and entries expire.
 *
 * @param {{ ttlMs?: number, maxEntries?: number, now?: () => number }} [opts]
 */
function weightOf(value) {
  let n = Buffer.byteLength(value?.source ?? '');
  for (const shot of Object.values(value?.shots ?? {})) n += shot?.length ?? 0;
  return n;
}

export function createSourceCache({
  ttlMs = 60 * 60 * 1000,
  maxEntries = 100,
  maxBytes = 256 * 1024 * 1024,
  now = Date.now,
} = {}) {
  const entries = new Map();

  function evict() {
    let total = 0;
    for (const entry of entries.values()) total += entry.bytes;
    while (entries.size > maxEntries || (total > maxBytes && entries.size > 1)) {
      const oldest = entries.keys().next().value;
      total -= entries.get(oldest).bytes;
      entries.delete(oldest);
    }
  }

  return {
    ttlMs,
    /** @param {string} scanId @param {{ source: string, resources: Map, mainUrl: string | null }} value @param {number} [ttl] */
    set(scanId, value, ttl) {
      const prev = entries.get(scanId);
      entries.delete(scanId);
      const expiresAt = ttl == null && prev ? prev.expiresAt : now() + (ttl ?? ttlMs);
      entries.set(scanId, { value, expiresAt, bytes: weightOf(value) });
      evict();
    },
    drop(scanId) {
      entries.delete(scanId);
    },
    /** Start the retention clock from now. Used when an authenticated scan completes. */
    expireIn(scanId, ms) {
      const entry = entries.get(scanId);
      if (!entry) return false;
      entry.expiresAt = now() + ms;
      return true;
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

    /** JPEG bytes for `before` or `after`. Same TTL as the HTML. Not written to the database. */
    setShot(scanId, which, buffer) {
      const value = this.get(scanId);
      if (!value || !buffer) return false;
      value.shots = { ...(value.shots ?? {}), [which]: buffer };
      this.set(scanId, value);
      return true;
    },

    getShot(scanId, which) {
      const shot = this.get(scanId)?.shots?.[which];
      return shot ?? null;
    },
  };
}
