import { NotImplementedError } from '../utils/errors.js';

/**
 * In-memory adapter. Bounded LRU so a long demo cannot exhaust memory.
 * Returns structured clones so callers can never mutate stored state.
 * @param {{ maxScans?: number }} [opts]
 * @returns {import('./scanRepository.js').ScanRepository}
 */
export function createMemoryScanRepository({ maxScans = 200 } = {}) {
  const scans = new Map();
  const since = new Date().toISOString();
  let usageCount = 0;

  const touch = (id, value) => {
    scans.delete(id);
    scans.set(id, value);
    while (scans.size > maxScans) scans.delete(scans.keys().next().value);
  };

  const later = (what) => async () => {
    throw new NotImplementedError(`MemoryScanRepository.${what}`);
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

    saveRepairs: later('saveRepairs'),
    listRepairs: later('listRepairs'),
    saveVerification: later('saveVerification'),
    listVerifications: later('listVerifications'),
  };
}
