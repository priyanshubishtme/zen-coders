const startedAt = Date.now();

/** @param {{ scanner: object, repo: object, llm: object, version: string }} deps */
export function createHealthController({ scanner, repo, llm, version }) {
  return {
    async get(_req, res) {
      const browser = await scanner.health().catch(() => 'unknown');
      res.json({
        status: browser === 'up' ? 'ok' : 'degraded',
        version,
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        checks: { browser, store: repo.kind, llm: llm.enabled ? 'on' : 'off' },
      });
    },
  };
}
