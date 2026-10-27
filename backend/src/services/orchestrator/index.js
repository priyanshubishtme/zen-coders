import { NotImplementedError } from '../../utils/errors.js';

/**
 * Orchestrator: the only module that sequences the pipeline.
 * scan:    validate size -> scanner.scan -> normalize -> computeScore -> store
 * repair:  load scan -> repairEngine.propose -> store repairs
 * verify:  load scan + repairs -> verifier.verify -> update statuses -> store
 * Controllers call the orchestrator; services never call each other directly.
 *
 * @param {{ scanner: object, repairEngine: object, verifier: object, llm: object,
 *   repo: import('../../repositories/scanRepository.js').ScanRepository, config: object }} _deps
 */
export function createOrchestrator(_deps) {
  const notYet = (what) => async () => {
    throw new NotImplementedError(what);
  };
  return {
    createScan: notYet('POST /scans'),
    getScan: notYet('GET /scans/:id'),
    proposeRepairs: notYet('POST /scans/:id/repairs'),
    verify: notYet('POST /scans/:id/verify'),
    getReport: notYet('GET /scans/:id/report'),
    getUsage: notYet('GET /usage'),
  };
}
