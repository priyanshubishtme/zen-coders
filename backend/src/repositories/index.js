import { createMemoryScanRepository } from './memoryScanRepository.js';

/**
 * Pick the store. Mongo arrives in Phase 4; until then, and whenever Mongo is
 * unreachable, the app runs on the in-memory adapter.
 * @param {{ STORE: 'memory' | 'mongo' }} _config
 */
export function createRepository(_config) {
  return createMemoryScanRepository();
}
