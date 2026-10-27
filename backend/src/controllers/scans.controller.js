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
    async events(req, res) {
      const id = req.valid.params.id;
      const scan = await orchestrator.getScan(id);
      res.status(200);
      res.set('Content-Type', 'text/event-stream; charset=utf-8');
      res.set('Cache-Control', 'no-cache, no-transform');
      res.set('Connection', 'keep-alive');
      res.set('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      const unsub = orchestrator.watchEvents(id, (event) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      if (scan.status === 'completed' || scan.status === 'failed') {
        unsub();
        return res.end();
      }
      req.on('close', () => {
        unsub();
        if (!res.writableEnded) res.end();
      });
    },
    async screenshot(req, res) {
      const buf = await orchestrator.getScreenshot(req.valid.params.id, req.valid.query.which);
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cache-Control', 'private, max-age=3600');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('image/jpeg').send(buf);
    },
    async source(req, res) {
      const html = await orchestrator.getSource(req.valid.params.id);
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('text/plain; charset=utf-8').send(html);
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
