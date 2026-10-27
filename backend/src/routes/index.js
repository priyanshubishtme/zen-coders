import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  CreateRepairsBody,
  CreateScanBody,
  ReportQuery,
  ScanIdParams,
  VerifyBody,
} from '../schemas/index.js';

/**
 * Route table. Mirrors docs/04-api-contract.md one-to-one.
 * @param {{ health: object, scans: object, usage: object }} c controllers
 * @param {{ scanLimiter: import('express').RequestHandler }} mw
 */
export function createRouter(c, { scanLimiter }) {
  const r = Router();

  r.get('/health', c.health.get);
  r.get('/usage', c.usage.get);

  r.post('/scans', scanLimiter, validate({ body: CreateScanBody }), c.scans.create);
  r.get('/scans/:id', validate({ params: ScanIdParams }), c.scans.get);
  r.post(
    '/scans/:id/repairs',
    scanLimiter,
    validate({ params: ScanIdParams, body: CreateRepairsBody }),
    c.scans.repairs,
  );
  r.post(
    '/scans/:id/verify',
    scanLimiter,
    validate({ params: ScanIdParams, body: VerifyBody }),
    c.scans.verify,
  );
  r.get(
    '/scans/:id/report',
    validate({ params: ScanIdParams, query: ReportQuery }),
    c.scans.report,
  );

  return r;
}
