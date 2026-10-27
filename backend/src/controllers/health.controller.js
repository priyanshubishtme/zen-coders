const startedAt = Date.now();

/** @param {{ scanner: object, repo: object, llm: object, config: object, version: string }} deps */
export function createHealthController({ scanner, repo, llm, config, version }) {
  return {
    async get(_req, res) {
      const browser = await scanner.health().catch(() => 'unknown');
      res.json({
        status: browser === 'up' ? 'ok' : 'degraded',
        version,
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        checks: {
          browser,
          store: repo.kind,
          llm: typeof llm.status === 'function' ? llm.status() : llm.enabled ? 'on' : 'off',
        },
        limits: {
          maxHtmlBytes: config.MAX_HTML_BYTES,
          privateUrlsAllowed: config.ALLOW_PRIVATE_URLS,
        },
      });
    },
  };
}
