import { canRead, canWrite } from '../services/access/decide.js';
import { REPORT_CSP, renderReport } from '../services/report/index.js';
import { AppError } from '../utils/errors.js';
import { writeEvents } from './auth.controller.js';

const missing = () => new AppError('NOT_FOUND', 'Scan not found. It may have expired.');

/** Thin HTTP adapters: validated input in, orchestrator call, JSON out. */
export function createScansController(orchestrator) {
  async function load(req, { write = false } = {}) {
    const scan = await orchestrator.getScan(req.valid.params.id);
    const allowed = write ? canWrite(scan, req.actor) : canRead(scan, req.actor);
    if (!allowed) throw missing();
    return scan;
  }

  return {
    async create(req, res) {
      const key = req.get('idempotency-key');
      const accepted = await orchestrator.createScan(req.valid.body, {
        idempotencyKey: key && key.length <= 128 ? key : undefined,
        actor: req.actor,
        ip: req.ip,
      });
      req.log.info({ scanId: accepted.id }, 'scan accepted');
      res.status(202).location(`/scans/${accepted.id}`).json(accepted);
    },
    async list(req, res) {
      const scans = await orchestrator.listScans(req.valid.query.ids);
      res.json({ scans: scans.filter((scan) => canRead(scan, req.actor)) });
    },
    async get(req, res) {
      res.json(await load(req));
    },
    async repairs(req, res) {
      await load(req, { write: true });
      res.json(await orchestrator.proposeRepairs(req.valid.params.id, req.valid.body, { ip: req.ip, plan: req.actor?.plan }));
    },
    async verify(req, res) {
      await load(req, { write: true });
      res.json(await orchestrator.verify(req.valid.params.id, req.valid.body));
    },
    async patched(req, res) {
      await load(req, { write: true });
      const html = await orchestrator.getPatchedHtml(req.valid.params.id);
      res.type('text/html').attachment(`accessfix-${req.valid.params.id}.html`).send(html);
    },
    async events(req, res) {
      const scan = await load(req);
      writeEvents(req, res, orchestrator, scan);
    },
    async screenshot(req, res) {
      await load(req);
      const buf = await orchestrator.getScreenshot(req.valid.params.id, req.valid.query.which);
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cache-Control', 'private, max-age=3600');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('image/jpeg').send(buf);
    },
    async source(req, res) {
      await load(req, { write: true });
      const html = await orchestrator.getSource(req.valid.params.id);
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('text/plain; charset=utf-8').send(html);
    },
    async report(req, res) {
      await load(req);
      const { format } = req.valid.query;
      const report = await orchestrator.getReport(req.valid.params.id);
      const rendered = renderReport(report, format);
      const name = `accessfix-report-${req.valid.params.id}.${rendered.ext}`;
      res.set('Cache-Control', 'no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      if (format === 'html' || format === 'md') res.set('Content-Security-Policy', REPORT_CSP);
      if (format === 'json') return res.attachment(name).json(rendered.body);
      res.type(rendered.type).attachment(name).send(rendered.body);
    },
    async cancel(req, res) {
      await load(req, { write: true });
      res.status(202).json(orchestrator.cancelScan(req.valid.params.id));
    },
    async zip(req, res) {
      await load(req, { write: true });
      const buf = await orchestrator.getZip(req.valid.params.id);
      res.set('Cache-Control', 'no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('application/zip').attachment(`accessfix-${req.valid.params.id}.zip`).send(buf);
    },
    async share(req, res) {
      const created = await orchestrator.createShare(req.valid.params.id, req.actor, req.valid.body);
      res.status(201).json(created);
    },
  };
}
