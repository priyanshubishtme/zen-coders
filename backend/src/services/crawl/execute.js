import { AppError } from '../../utils/errors.js';
import { sha256 } from '../../utils/hash.js';
import { crawlCaps, tierCaps } from '../quota/caps.js';
import { normalize } from '../scanner/normalize.js';
import { computeScore } from '../scorer/index.js';
import { stateForHost } from '../vault/authState.js';
import { loadRobots } from './robots.js';
import { SKIP_PAGE, runCrawl } from './run.js';
import { hostOf } from './url.js';

/**
 * One crawl is one scan. Pages run one after another. The 3-minute clock
 * starts here, when the job starts running, not when it was queued.
 */
export async function executeCrawl({
  scanId,
  seedUrl,
  options,
  config,
  scanner,
  repo,
  sources,
  note,
  signal,
  lookup,
  plan,
  ownerId,
  meter,
  authMaterial,
  listEvents,
}) {
  const caps = crawlCaps(config, plan);
  let maxPages = caps.maxPages;
  if (config.QUOTAS_ENABLED && meter && ownerId) {
    const tier = tierCaps(config, plan);
    const used = await meter.pagesUsed(ownerId);
    if (used >= tier.pages) {
      throw new AppError(
        'RATE_LIMITED',
        'The daily page limit has been reached. Try again tomorrow.',
        { retryAfterSec: 3600 },
      );
    }
    maxPages = Math.min(maxPages, tier.pages - used);
  }

  const robots = await loadRobots(seedUrl, {
    allowPrivate: config.ALLOW_PRIVATE_URLS,
    lookup,
    timeoutMs: config.SUBREQUEST_TIMEOUT_MS,
  });
  note(scanId, 'crawl', 'Crawl started');
  const finishedRaw = [];
  let cacheIndex = 0;

  const result = await runCrawl({
    seedUrl,
    maxPages,
    maxDepth: caps.maxDepth,
    budgetMs: config.CRAWL_BUDGET_MS,
    gapMs: config.CRAWL_GAP_MS,
    delayCapMs: config.CRAWL_DELAY_CAP_MS,
    robotsDelayMs: robots.delayMs,
    allow: (url) => robots.allowed(url),
    signal,
    onEvent: (event) => note(scanId, 'crawl', event.message),
    scanPage: async (ctx) => {
      const host = ctx.pinnedHost || hostOf(ctx.url);
      const timeoutMs = Math.min(config.PAGE_BUDGET_MS, ctx.timeoutMs);
      let raw;
      try {
        raw = await scanner.scan(
          { type: 'url', url: ctx.url },
          options,
          {
            signal: ctx.signal,
            timeoutMs,
            collectLinks: true,
            pinnedHost: ctx.pinnedHost,
            storageState: stateForHost(authMaterial, host),
            waitFor: options.waitFor,
          },
        );
      } catch (err) {
        if (ctx.signal.aborted || signal?.aborted) return { aborted: true };
        if (err?.code === 'SCAN_TIMEOUT') return { skip: SKIP_PAGE, finalUrl: ctx.url, links: [] };
        throw err;
      }
      if (ctx.signal.aborted || signal?.aborted) return { aborted: true };
      const source = raw.source ?? '';
      if (Buffer.byteLength(source) > config.PAGE_HTML_MAX_BYTES) {
        return { skip: 'skipped (page too large)', finalUrl: raw.page?.finalUrl || ctx.url, links: raw.links ?? [] };
      }
      const buckets = normalize(raw, { inputHash: sha256(`url\n${raw.page?.finalUrl || ctx.url}`) });
      const score = computeScore(raw, options);
      const index = cacheIndex;
      cacheIndex += 1;
      const cached = {
        source,
        resources: raw.resources ?? new Map(),
        mainUrl: raw.page?.finalUrl || ctx.url,
        shots: raw.screenshot ? { before: raw.screenshot } : {},
      };
      if (source) {
        sources.set(`${scanId}#${index}`, cached);
        if (index === 0) sources.set(scanId, cached);
      }
      finishedRaw.push(raw);
      if (meter && ownerId) await meter.addPages(ownerId, 1);
      return {
        finalUrl: raw.page?.finalUrl || ctx.url,
        links: raw.links ?? [],
        record: {
          cacheIndex: index,
          score,
          violations: buckets.violations,
          advisory: buckets.advisory,
          manualReview: buckets.manualReview,
          title: raw.page?.title ?? null,
          renderWarning: raw.renderWarning ?? null,
          keyboard: raw.keyboard?.checks ?? [],
          settled: Boolean(raw.page?.settled),
        },
      };
    },
  });

  if (options.authUsed) {
    sources.expireIn(scanId, config.AUTH_RETENTION_MS);
    for (let i = 0; i < cacheIndex; i += 1) sources.expireIn(`${scanId}#${i}`, config.AUTH_RETENTION_MS);
  }

  const finished = result.pages.filter((page) => page.status === 'completed');
  const failedOnly = finished.length === 0 && result.pages.every((page) => page.status === 'failed');
  const score = rollupScore(finishedRaw, options);
  const first = finished[0];
  note(
    scanId,
    failedOnly ? 'failed' : 'score',
    failedOnly ? result.pages[0]?.reason || 'The crawl failed.' : `Score ${score?.value ?? 'N/A'}`,
  );
  if (result.partial && !failedOnly) note(scanId, 'crawl', 'Crawl finished with some pages skipped.');

  await repo.updateScan(scanId, {
    status: failedOnly ? 'failed' : 'completed',
    stage: failedOnly ? 'failed' : 'done',
    partial: result.partial,
    pinnedHost: result.pinnedHost,
    pages: result.pages,
    violations: dedupe(finished.flatMap((page) => page.violations ?? [])),
    advisory: dedupe(finished.flatMap((page) => page.advisory ?? [])),
    manualReview: dedupe(finished.flatMap((page) => page.manualReview ?? [])),
    headingOutline: (finishedRaw[0]?.headingOutline ?? []).map((item) => ({
      level: item.level,
      text: item.text,
      target: Array.isArray(item.target)
        ? item.target.map((part) => (Array.isArray(part) ? part.join(' >>> ') : String(part)))
        : [],
      style: item.style ?? null,
    })),
    score,
    keyboard: finished.flatMap((page) => (page.keyboard ?? []).map((check) => ({ ...check, url: page.url }))),
    renderWarning: finished.find((page) => page.renderWarning)?.renderWarning ?? null,
    page: first
      ? { finalUrl: first.url, title: first.title ?? null, settled: Boolean(first.settled) }
      : { finalUrl: seedUrl, title: null, settled: false },
    network: finishedRaw[0]?.network ?? { requests: 0, blocked: 0, blockedSamples: [] },
    engine: finishedRaw[0] ? { axeVersion: finishedRaw[0].axeVersion } : null,
    shots: { before: Boolean(finishedRaw[0]?.screenshot), after: false },
    viewport: finishedRaw[0]?.viewport ?? null,
    error: failedOnly
      ? { code: 'FETCH_FAILED', message: result.pages[0]?.reason || 'The crawl failed.' }
      : null,
    events: listEvents(),
    completedAt: new Date().toISOString(),
  });
  return result;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.signature || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Element-weighted aggregate of the same formula, not an average of page scores. */
function rollupScore(raws, options) {
  if (!raws.length) return null;
  const passes = [];
  for (const raw of raws) {
    for (const pass of raw.passes ?? []) {
      const hit = passes.find((item) => item.id === pass.id);
      if (hit) hit.count += pass.count;
      else passes.push({ ...pass });
    }
  }
  return computeScore(
    { ...raws[0], violations: raws.flatMap((raw) => raw.violations ?? []), passes, incomplete: [] },
    options,
  );
}
