export function createUsageController(orchestrator) {
  return {
    async get(_req, res) {
      res.json(await orchestrator.getUsage());
    },
  };
}
