import { createMemoryScanRepository } from './memoryScanRepository.js';

/**
 * Pick the store. The Mongo adapter is a stub until Phase 4, so STORE=mongo
 * still runs on memory (with a warning) rather than failing every request.
 * @param {{ STORE: 'memory' | 'mongo', STORE_MAX_SCANS: number }} config
 * @param {{ warn: Function }} [logger]
 */
export function createRepository(config, logger) {
  if (config.STORE === 'mongo') {
    logger?.warn('STORE=mongo is not implemented yet (Phase 4); using the in-memory store.');
  }
  return createMemoryScanRepository({ maxScans: config.STORE_MAX_SCANS });
}
