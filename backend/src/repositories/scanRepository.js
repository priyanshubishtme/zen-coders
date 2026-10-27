/**
 * Storage contract. Every adapter must pass tests/repositories.contract.test.js.
 * Scans are stored as plain objects matching schemas/scan.js (input hash,
 * results and timings; never the raw HTML).
 *
 * @typedef {object} ScanRepository
 * @property {'memory' | 'mongo'} kind
 * @property {(scan: object) => Promise<object>} saveScan        insert; returns the stored copy
 * @property {(id: string, patch: object) => Promise<object | null>} updateScan  shallow merge; null if missing
 * @property {(id: string) => Promise<object | null>} getScan
 * @property {(entry: { scanId: string, kind: string, at: string }) => Promise<void>} recordUsage
 * @property {() => Promise<{ scans: number, since: string }>} usageSummary
 * @property {(scanId: string, repairs: object[]) => Promise<void>} saveRepairs        Phase 2
 * @property {(scanId: string) => Promise<object[]>} listRepairs                       Phase 2
 * @property {(result: object) => Promise<void>} saveVerification                      Phase 2
 * @property {(scanId: string) => Promise<object[]>} listVerifications
 * @property {(ids: string[]) => Promise<object[]>} listByIds  capability-list; unknown ids omitted
 */

export const REPOSITORY_METHODS = Object.freeze([
  'saveScan',
  'updateScan',
  'getScan',
  'listByIds',
  'recordUsage',
  'usageSummary',
  'saveRepairs',
  'listRepairs',
  'saveVerification',
  'listVerifications',
]);
