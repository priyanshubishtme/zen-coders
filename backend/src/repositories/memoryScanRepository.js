/**
 * In-memory adapter. Bounded LRU so a long demo cannot exhaust memory.
 * Returns structured clones so callers can never mutate stored state.
 * Repairs and verifications live and die with their scan.
 * @param {{ maxScans?: number }} [opts]
 * @returns {import('./scanRepository.js').ScanRepository}
 */
export function createMemoryScanRepository({ maxScans = 200, ttlMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  const scans = new Map();
  const repairs = new Map();
  const verifications = new Map();
  const since = new Date().toISOString();
  let usageCount = 0;

  const living = (scan) => {
    if (!scan) return null;
    if (ttlMs && scan.createdAt && Date.now() - Date.parse(scan.createdAt) > ttlMs) return null;
    return scan;
  };

  const touch = (id, value) => {
    scans.delete(id);
    scans.set(id, value);
    while (scans.size > maxScans) {
      const oldest = scans.keys().next().value;
      scans.delete(oldest);
      repairs.delete(oldest);
      verifications.delete(oldest);
    }
  };

  return {
    kind: 'memory',

    async saveScan(scan) {
      touch(scan.id, structuredClone(scan));
      return structuredClone(scan);
    },

    async updateScan(id, patch) {
      const current = scans.get(id);
      if (!current) return null;
      const next = { ...current, ...structuredClone(patch) };
      touch(id, next);
      return structuredClone(next);
    },

    async getScan(id) {
      const scan = living(scans.get(id));
      if (!scan) {
        scans.delete(id);
        repairs.delete(id);
        verifications.delete(id);
        return null;
      }
      return structuredClone(scan);
    },

    async listByIds(ids) {
      const out = [];
      for (const id of ids) {
        const scan = await this.getScan(id);
        if (scan) out.push(scan);
      }
      return out;
    },

    async recordUsage() {
      usageCount += 1;
    },

    async usageSummary() {
      return { scans: usageCount, since };
    },

    /** Replaces the scan's repairs (the latest proposal wins). */
    async saveRepairs(scanId, list) {
      repairs.set(scanId, structuredClone(list));
    },

    async listRepairs(scanId) {
      return structuredClone(repairs.get(scanId) ?? []);
    },

    async saveVerification(result) {
      verifications.set(result.scanId, [...(verifications.get(result.scanId) ?? []), structuredClone(result)]);
    },

    /** Oldest first. */
    async listVerifications(scanId) {
      return structuredClone(verifications.get(scanId) ?? []);
    },
  };
}
