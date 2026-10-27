/**
 * In-memory adapter. Bounded LRU so a long demo cannot exhaust memory.
 * Returns structured clones so callers can never mutate stored state.
 * Repairs and verifications live and die with their scan.
 * @param {{ maxScans?: number }} [opts]
 * @returns {import('./scanRepository.js').ScanRepository}
 */
export function createMemoryScanRepository({ maxScans = 200 } = {}) {
  const scans = new Map();
  const repairs = new Map();
  const verifications = new Map();
  const since = new Date().toISOString();
  let usageCount = 0;

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
      const scan = scans.get(id);
      return scan ? structuredClone(scan) : null;
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
