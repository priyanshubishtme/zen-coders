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
        plans: {
          loggedOutScansDay: config.LOGGED_OUT_SCANS_DAY,
          free: {
            scansDay: config.FREE_SCANS_DAY,
            pagesDay: config.FREE_PAGES_DAY,
            tokensDay: config.TOKEN_DAILY_OVERRIDE || config.FREE_TOKENS_DAY,
            crawlPages: config.QUOTAS_ENABLED ? config.FREE_CRAWL_PAGES : config.CRAWL_MAX_PAGES,
          },
          pro: {
            scansDay: config.PRO_SCANS_DAY,
            pagesDay: config.PRO_PAGES_DAY,
            tokensDay: config.PRO_TOKENS_DAY,
            crawlPages: config.QUOTAS_ENABLED ? config.PRO_CRAWL_PAGES : config.CRAWL_MAX_PAGES,
          },
        },
        crawl: {
          maxPages: config.CRAWL_MAX_PAGES,
          maxDepth: config.CRAWL_MAX_DEPTH,
          budgetMs: config.CRAWL_BUDGET_MS,
          gapMs: config.CRAWL_GAP_MS,
          zipMaxBytes: config.ZIP_MAX_BYTES,
        },
      });
    },
  };
}
