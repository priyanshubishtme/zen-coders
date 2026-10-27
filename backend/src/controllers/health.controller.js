const startedAt = Date.now();

/** @param {{ scanner: object, repo: object, llm: object, config: object, version: string, meter?: object, vault?: object }} deps */
export function createHealthController({ scanner, repo, llm, config, version, meter, vault }) {
  return {
    async get(_req, res) {
      const browser = await scanner.health().catch(() => 'unknown');
      const tokenCeiling = meter ? await meter.ceilingStatus(config.LLM_TOKEN_DAILY_CEILING ?? 0) : 'ok';
      res.json({
        status: browser === 'up' ? 'ok' : 'degraded',
        version,
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        checks: {
          browser,
          store: repo.kind,
          llm: typeof llm.status === 'function' ? llm.status() : llm.enabled ? 'on' : 'off',
        },
        quotas: config.QUOTAS_ENABLED ? 'on' : 'off',
        tokenCeiling,
        authenticatedScanning: vault?.enabled ? 'on' : 'disabled: no key',
        limits: {
          maxHtmlBytes: config.MAX_HTML_BYTES,
          privateUrlsAllowed: config.ALLOW_PRIVATE_URLS,
        },
      });
    },
  };
}
