import { hostOf, normalizeCrawlUrl } from './url.js';

export const SKIP_TIME = 'skipped (time limit)';
export const SKIP_CANCEL = 'skipped (cancelled)';
export const SKIP_ROBOTS = 'skipped (robots.txt)';
export const SKIP_OFF_HOST = 'skipped (left pinned host)';
export const SKIP_CAP = 'skipped (page limit)';
export const SKIP_PAGE = 'skipped (page time)';

/**
 * Breadth-first, one page at a time. A limit stops the crawl on the shallowest
 * pages already queued. The page in progress is aborted and stored as skipped,
 * never as a half-finished result.
 *
 * @param {{ seedUrl: string, maxPages: number, maxDepth: number, budgetMs: number,
 *   gapMs: number, delayCapMs?: number, robotsDelayMs?: number,
 *   allow?: (url: string) => boolean, signal?: AbortSignal,
 *   scanPage: (ctx: { url: string, depth: number, signal: AbortSignal, pinnedHost: string | null, timeoutMs: number }) => Promise<object>,
 *   onEvent?: (event: { message: string }) => void,
 *   now?: () => number, sleep?: (ms: number) => Promise<void> }} opts
 */
export async function runCrawl(opts) {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const delayCap = opts.delayCapMs ?? 5000;
  const pace = Math.min(delayCap, Math.max(opts.gapMs ?? 0, opts.robotsDelayMs ?? 0));
  const started = now();
  const deadline = started + opts.budgetMs;
  /** @type {object[]} */
  const pages = [];
  const seen = new Set();
  const queued = new Set([opts.seedUrl]);
  /** @type {{ url: string, depth: number }[]} */
  const queue = [{ url: opts.seedUrl, depth: 0 }];
  let pinnedHost = null;

  const skipQueued = (reason) => {
    while (queue.length) {
      const next = queue.shift();
      if (!next || seen.has(next.url)) continue;
      seen.add(next.url);
      pages.push(blank(next.url, next.depth, reason));
    }
  };

  while (queue.length) {
    if (opts.signal?.aborted) {
      skipQueued(SKIP_CANCEL);
      break;
    }
    const item = queue.shift();
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);

    const finished = pages.filter((p) => p.status === 'completed').length;
    if (finished >= opts.maxPages) {
      pages.push(blank(item.url, item.depth, SKIP_CAP));
      skipQueued(SKIP_CAP);
      break;
    }
    if (pinnedHost && hostOf(item.url) !== pinnedHost) {
      pages.push(blank(item.url, item.depth, SKIP_OFF_HOST));
      continue;
    }
    if (opts.allow && !opts.allow(item.url)) {
      pages.push(blank(item.url, item.depth, SKIP_ROBOTS));
      continue;
    }
    if (now() >= deadline) {
      pages.push(blank(item.url, item.depth, SKIP_TIME));
      skipQueued(SKIP_TIME);
      break;
    }

    const pageSignal = new AbortController();
    const onAbort = () => pageSignal.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    const remaining = Math.max(1, deadline - now());
    const timer = setTimeout(() => pageSignal.abort(), remaining);
    opts.onEvent?.({ message: `Scanning ${item.url}` });

    /** @type {{ ok: true, value: object } | { ok: false, aborted: boolean, err?: Error }} */
    let raced;
    try {
      const scanPromise = opts
        .scanPage({
          url: item.url,
          depth: item.depth,
          signal: pageSignal.signal,
          pinnedHost,
          timeoutMs: remaining,
        })
        .then((value) => ({ ok: true, value }))
        .catch((err) => ({ ok: false, aborted: pageSignal.signal.aborted || Boolean(opts.signal?.aborted), err }));
      const budget = new Promise((resolve) => {
        pageSignal.signal.addEventListener('abort', () => resolve({ ok: false, aborted: true }), { once: true });
      });
      raced = await Promise.race([scanPromise, budget]);
      if (!raced.ok) await scanPromise.catch(() => {});
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }

    const cancelled = Boolean(opts.signal?.aborted);
    const aborted = !raced.ok
      ? raced.aborted || pageSignal.signal.aborted || cancelled
      : pageSignal.signal.aborted || cancelled || raced.value?.aborted;
    if (aborted) {
      pages.push(blank(item.url, item.depth, cancelled ? SKIP_CANCEL : SKIP_TIME));
      skipQueued(cancelled ? SKIP_CANCEL : SKIP_TIME);
      break;
    }
    if (!raced.ok) {
      pages.push({
        ...blank(item.url, item.depth, raced.err?.message || 'The page could not be scanned.'),
        status: 'failed',
      });
      continue;
    }
    if (raced.value?.skip) {
      pages.push(blank(item.url, item.depth, raced.value.skip));
      continue;
    }

    const finalUrl = raced.value.finalUrl || item.url;
    let finalHost = hostOf(finalUrl);
    if (!pinnedHost) {
      pinnedHost = finalHost;
      opts.onEvent?.({ message: `Crawl pinned to ${pinnedHost}` });
    } else if (finalHost !== pinnedHost) {
      pages.push(blank(item.url, item.depth, SKIP_OFF_HOST));
      continue;
    }

    pages.push({
      ...(raced.value.record ?? {}),
      url: finalUrl,
      depth: item.depth,
      status: 'completed',
      reason: null,
    });
    opts.onEvent?.({ message: `Finished ${finalUrl}` });

    if (item.depth < opts.maxDepth) {
      for (const link of raced.value.links ?? []) {
        const next = normalizeCrawlUrl(link, finalUrl);
        if (!next || queued.has(next)) continue;
        if (hostOf(next) !== pinnedHost) continue;
        queued.add(next);
        queue.push({ url: next, depth: item.depth + 1 });
      }
    }

    if (queue.length && pace > 0) {
      const left = deadline - now();
      if (left <= 0) {
        skipQueued(SKIP_TIME);
        break;
      }
      await sleep(Math.min(pace, left));
    }
  }

  return {
    pinnedHost,
    partial: pages.some((p) => p.status !== 'completed'),
    pages,
  };
}

function blank(url, depth, reason) {
  return { url, depth, status: 'skipped', reason, score: null, violations: [], advisory: [], manualReview: [] };
}
