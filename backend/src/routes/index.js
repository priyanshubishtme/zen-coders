import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  CreateRepairsBody,
  CreateScanBody,
  ListScansQuery,
  ReportQuery,
  ScanIdParams,
  ScreenshotQuery,
  ShareBody,
  ShareParams,
  SignupBody,
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
  r.post('/signup', validate({ body: SignupBody }), c.auth.signup);
  r.post('/login', validate({ body: SignupBody }), c.auth.login);
  r.post('/logout', c.auth.logout);
  r.get('/me', c.auth.me);
  r.get('/shares/:token', validate({ params: ShareParams }), c.auth.shareReport);
  r.get('/shares/:token/events', validate({ params: ShareParams }), c.auth.shareEvents);
  r.get(
    '/shares/:token/screenshot',
    validate({ params: ShareParams, query: ScreenshotQuery }),
    c.auth.shareScreenshot,
  );
  r.delete('/shares/:token', validate({ params: ShareParams }), c.auth.revoke);

  r.post('/scans', scanLimiter, validate({ body: CreateScanBody }), c.scans.create);
  r.get('/scans', validate({ query: ListScansQuery }), c.scans.list);
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
  r.get('/scans/:id/patched.html', validate({ params: ScanIdParams }), c.scans.patched);
  r.get('/scans/:id/pages.zip', validate({ params: ScanIdParams }), c.scans.zip);
  r.post('/scans/:id/cancel', validate({ params: ScanIdParams }), c.scans.cancel);
  r.post('/scans/:id/share', validate({ params: ScanIdParams, body: ShareBody }), c.scans.share);
  r.get('/scans/:id/events', validate({ params: ScanIdParams }), c.scans.events);
  r.get(
    '/scans/:id/screenshot',
    validate({ params: ScanIdParams, query: ScreenshotQuery }),
    c.scans.screenshot,
  );
  r.get('/scans/:id/source', validate({ params: ScanIdParams }), c.scans.source);
  r.get(
    '/scans/:id/report',
    validate({ params: ScanIdParams, query: ReportQuery }),
    c.scans.report,
  );

  return r;
}
