import { NotImplementedError } from '../utils/errors.js';
import { REPOSITORY_METHODS } from './scanRepository.js';

/**
 * In-memory adapter (Phase 1). Bounded LRU so a long demo cannot exhaust memory.
 * @returns {import('./scanRepository.js').ScanRepository}
 */
export function createMemoryScanRepository() {
  const repo = { kind: 'memory' };
  for (const method of REPOSITORY_METHODS) {
    repo[method] = async () => {
      throw new NotImplementedError(`MemoryScanRepository.${method}`);
    };
  }
  return repo;
}
