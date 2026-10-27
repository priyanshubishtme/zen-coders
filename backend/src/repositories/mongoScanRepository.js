import { NotImplementedError } from '../utils/errors.js';
import { REPOSITORY_METHODS } from './scanRepository.js';

/**
 * MongoDB Atlas adapter (Phase 4). Planned shape: collection `scans` keyed by
 * `id` with an index on `inputHash` and a TTL index on `createdAt`.
 * Until then every method throws NOT_IMPLEMENTED and the factory falls back
 * to memory.
 * @param {{ uri: string }} _opts
 * @returns {import('./scanRepository.js').ScanRepository}
 */
export function createMongoScanRepository(_opts) {
  const repo = { kind: 'mongo' };
  for (const method of REPOSITORY_METHODS) {
    repo[method] = async () => {
      throw new NotImplementedError(`MongoScanRepository.${method}`);
    };
  }
  return repo;
}
