/** Page cap and depth for one crawl. Free/Pro split only while quotas are on. */
export function crawlCaps(config, plan) {
  if (!config.QUOTAS_ENABLED) {
    return { maxPages: config.CRAWL_MAX_PAGES, maxDepth: config.CRAWL_MAX_DEPTH };
  }
  return {
    maxPages: plan === 'pro' ? config.PRO_CRAWL_PAGES : config.FREE_CRAWL_PAGES,
    maxDepth: config.CRAWL_MAX_DEPTH,
  };
}

/** Daily scan, page, and token caps for a signed-in plan. Not used while quotas are off. */
export function tierCaps(config, plan) {
  if (plan === 'pro') {
    return { scans: config.PRO_SCANS_DAY, pages: config.PRO_PAGES_DAY, tokens: config.PRO_TOKENS_DAY };
  }
  const tokens = config.TOKEN_DAILY_OVERRIDE > 0 ? config.TOKEN_DAILY_OVERRIDE : config.FREE_TOKENS_DAY;
  return { scans: config.FREE_SCANS_DAY, pages: config.FREE_PAGES_DAY, tokens };
}
