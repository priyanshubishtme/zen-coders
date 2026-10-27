/** @param {number | Date | (() => number)} [now] */
function clockOf(now) {
  if (typeof now === 'function') return now;
  return () => (now instanceof Date ? now.getTime() : Date.now());
}

export function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Process-wide counters. `persist` is how STORE=mongo keeps the UTC-day
 * ceiling across a restart. Limits are enforced by the caller; this only counts
 * unless `take` is asked to refuse.
 *
 * @param {{ persist?: { get: (key: string) => Promise<number>, inc: (key: string, n: number) => Promise<number> },
 *   now?: () => number, ceiling?: number }} [opts]
 */
export function createMeter({ persist, now = Date.now, ceiling = 0 } = {}) {
  const mem = new Map();

  async function get(key) {
    if (persist) return persist.get(key);
    return mem.get(key) ?? 0;
  }

  async function add(key, n) {
    if (persist) {
      const next = await persist.inc(key, n);
      mem.set(key, next);
      return next;
    }
    const next = (mem.get(key) ?? 0) + n;
    mem.set(key, next);
    return next;
  }

  const day = () => utcDay(now());

  return {
    now,
    /** @param {string} ownerId @param {number} [n] */
    async addPages(ownerId, n = 1) {
      if (!ownerId) return 0;
      return add(`pages:${day()}:${ownerId}`, n);
    },
    async pagesUsed(ownerId) {
      if (!ownerId) return 0;
      return get(`pages:${day()}:${ownerId}`);
    },
    /** @param {string} id user id or `ip:<address>` */
    async addScans(id, n = 1) {
      return add(`scans:${day()}:${id}`, n);
    },
    async scansUsed(id) {
      return get(`scans:${day()}:${id}`);
    },
    /**
     * Refuse before a call when the ceiling or the tier cap would be crossed.
     * Always records real usage via `recordTokens`, including while quotas are off.
     * @returns {'ok' | 'ceiling' | 'over-budget'}
     */
    async allowTokens({ est, quotasEnabled, ceiling: cap, tierCap, ownerKey }) {
      const today = day();
      if (cap > 0) {
        const used = await get(`ceiling:${today}`);
        const hit = await get(`ceiling-hit:${today}`);
        if (hit > 0 || used + est > cap) {
          if (hit === 0) await add(`ceiling-hit:${today}`, 1);
          return 'ceiling';
        }
      }
      if (quotasEnabled && tierCap > 0 && ownerKey) {
        const used = await get(`tokens:${today}:${ownerKey}`);
        if (used + est > tierCap) return 'over-budget';
      }
      return 'ok';
    },
    async recordTokens({ n, ownerKey }) {
      const today = day();
      await add(`ceiling:${today}`, n);
      if (ownerKey) await add(`tokens:${today}:${ownerKey}`, n);
    },
    async ceilingStatus(cap = ceiling) {
      if (!(cap > 0)) return 'ok';
      const today = day();
      const used = await get(`ceiling:${today}`);
      const hit = await get(`ceiling-hit:${today}`);
      return hit > 0 || used >= cap ? 'reached' : 'ok';
    },
    async tokensUsed(ownerKey) {
      return get(`tokens:${day()}:${ownerKey}`);
    },
  };
}

/** In-memory stand-in for the Mongo counter collection. Shared by two meters, it survives "restart". */
export function memoryPersist() {
  const rows = new Map();
  return {
    async get(key) {
      return rows.get(key) ?? 0;
    },
    async inc(key, n) {
      const next = (rows.get(key) ?? 0) + n;
      rows.set(key, next);
      return next;
    },
  };
}

/** Mongo `counters` collection. `findOneAndUpdate` may return the document or `{ value }`. */
export function mongoPersist(collection) {
  return {
    async get(key) {
      const doc = await collection.findOne({ key });
      return doc?.n ?? 0;
    },
    async inc(key, n) {
      const raw = await collection.findOneAndUpdate(
        { key },
        { $inc: { n }, $setOnInsert: { key } },
        { upsert: true, returnDocument: 'after' },
      );
      const doc = raw && typeof raw === 'object' && 'value' in raw && !('n' in raw) ? raw.value : raw;
      return doc?.n ?? n;
    },
  };
}
