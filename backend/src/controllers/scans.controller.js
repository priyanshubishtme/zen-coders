/** Thin HTTP adapters: validated input in, orchestrator call, JSON out. */
export function createScansController(orchestrator) {
  return {
    async create(req, res) {
      res.status(201).json(await orchestrator.createScan(req.valid.body));
    },
    async get(req, res) {
      res.json(await orchestrator.getScan(req.valid.params.id));
    },
    async repairs(req, res) {
      res.json(await orchestrator.proposeRepairs(req.valid.params.id, req.valid.body));
    },
    async verify(req, res) {
      res.json(await orchestrator.verify(req.valid.params.id, req.valid.body));
    },
    async report(req, res) {
      const { format } = req.valid.query;
      const report = await orchestrator.getReport(req.valid.params.id, format);
      if (format === 'json') return res.json(report);
      res.type(format === 'md' ? 'text/markdown' : 'text/html').send(report);
    },
  };
}
