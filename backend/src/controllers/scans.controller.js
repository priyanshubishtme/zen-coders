import { REPORT_CSP, renderReport } from '../services/report/index.js';

/** Thin HTTP adapters: validated input in, orchestrator call, JSON out. */
export function createScansController(orchestrator) {
  return {
    async create(req, res) {
      const key = req.get('idempotency-key');
      const accepted = await orchestrator.createScan(req.valid.body, {
        idempotencyKey: key && key.length <= 128 ? key : undefined,
      });
      req.log.info({ scanId: accepted.id }, 'scan accepted');
      res.status(202).location(`/scans/${accepted.id}`).json(accepted);
    },
    async list(req, res) {
      res.json({ scans: await orchestrator.listScans(req.valid.query.ids) });
    },
    async get(req, res) {
      res.json(await orchestrator.getScan(req.valid.params.id));
    },
    async repairs(req, res) {
      res.json(await orchestrator.proposeRepairs(req.valid.params.id, req.valid.body, { ip: req.ip }));
    },
    async verify(req, res) {
      res.json(await orchestrator.verify(req.valid.params.id, req.valid.body));
    },
    async patched(req, res) {
      const html = await orchestrator.getPatchedHtml(req.valid.params.id);
      res.type('text/html').attachment(`accessfix-${req.valid.params.id}.html`).send(html);
    },
    async report(req, res) {
      const { format } = req.valid.query;
      const report = await orchestrator.getReport(req.valid.params.id);
      const rendered = renderReport(report, format);
      const name = `accessfix-report-${req.valid.params.id}.${rendered.ext}`;
      res.set('X-Content-Type-Options', 'nosniff');
      if (format === 'html' || format === 'md') res.set('Content-Security-Policy', REPORT_CSP);
      if (format === 'json') {
        return res.attachment(name).json(rendered.body);
      }
      res.type(rendered.type).attachment(name).send(rendered.body);
    },
  };
}
