/**
 * Storage contract. The in-memory adapter (Phase 1) and the MongoDB adapter
 * (Phase 4) must both pass the same contract test suite.
 *
 * @typedef {object} ScanRepository
 * @property {'memory' | 'mongo'} kind
 * @property {(scan: object) => Promise<object>} saveScan
 * @property {(id: string) => Promise<object | null>} getScan
 * @property {(scanId: string, repairs: object[]) => Promise<void>} saveRepairs
 * @property {(scanId: string) => Promise<object[]>} listRepairs
 * @property {(result: object) => Promise<void>} saveVerification
 * @property {(scanId: string) => Promise<object[]>} listVerifications
 * @property {(entry: object) => Promise<void>} recordUsage
 * @property {() => Promise<object>} usageSummary
 */

export const REPOSITORY_METHODS = Object.freeze([
  'saveScan',
  'getScan',
  'saveRepairs',
  'listRepairs',
  'saveVerification',
  'listVerifications',
  'recordUsage',
  'usageSummary',
]);
