import { createMemoryScanRepository } from './memoryScanRepository.js';
import { createMongoScanRepository } from './mongoScanRepository.js';

/**
 * Pick the store. STORE=mongo requires MONGODB_URI (enforced in loadConfig).
 * @param {{ STORE: 'memory' | 'mongo', STORE_MAX_SCANS: number, MONGODB_URI?: string, SCAN_TTL_DAYS?: number }} config
 * @param {{ warn: Function }} [logger]
 */
export function createRepository(config, logger) {
  if (config.STORE === 'mongo') {
    logger?.info('Using MongoDB scan store.');
    return createMongoScanRepository({
      uri: config.MONGODB_URI,
      ttlDays: config.SCAN_TTL_DAYS ?? 30,
    });
  }
  return createMemoryScanRepository({
    maxScans: config.STORE_MAX_SCANS,
    ttlMs: (config.SCAN_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  });
}
