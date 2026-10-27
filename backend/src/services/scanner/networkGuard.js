import { AppError } from '../../utils/errors.js';
import { pinnedFetch } from '../../utils/pinnedFetch.js';
import { resolveSafeUrl } from '../../utils/urlSafety.js';

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)\b/i;
const MAX_BLOCKED_SAMPLES = 10;

/**
 * Route every browser request through our safety check and a pinned fetch.
 * Records counts for the scan result and the reason the main document failed.
 *
 * @param {import('playwright').BrowserContext} context
 * @param {{ allowPrivate: boolean, lookup?: Function, maxRequests: number, maxRedirects: number,
 *   maxBytes: number, timeoutMs: number, isMainDocument: (req: import('playwright').Request) => boolean }} opts
 */
export async function installNetworkGuard(context, opts) {
  // Counts are per unique URL: Chromium may request the same failed resource more than once.
  const state = { requests: 0, blocked: 0, blockedSamples: [], mainError: null };
  const seen = new Set();
  const seenBlocked = new Set();
  let attempts = 0;

  /** Record a resource the page did not get (blocked or failed) so results can say so. */
  const block = (route, req, reason, isMain, error, abortCode = 'blockedbyclient') => {
    if (!seenBlocked.has(req.url())) {
      seenBlocked.add(req.url());
      state.blocked += 1;
      if (state.blockedSamples.length < MAX_BLOCKED_SAMPLES) {
        state.blockedSamples.push({ url: req.url().slice(0, 300), reason });
      }
    }
    if (isMain && !state.mainError) state.mainError = error;
    return route.abort(abortCode).catch(() => {});
  };

  await context.routeWebSocket(/.*/, (ws) => ws.close()).catch(() => {});

  await context.route('**/*', async (route) => {
    const req = route.request();
    let isMain = false;
    try {
      isMain = opts.isMainDocument(req);
    } catch {
      isMain = false;
    }

    attempts += 1;
    if (!seen.has(req.url())) {
      seen.add(req.url());
      state.requests += 1;
    }
    if (state.requests > opts.maxRequests || attempts > opts.maxRequests * 2) {
      return block(route, req, 'request limit reached', isMain, null);
    }

    if (isMain) {
      let hops = 0;
      for (let r = req.redirectedFrom(); r; r = r.redirectedFrom()) hops += 1;
      if (hops > opts.maxRedirects) {
        const err = new AppError(
          'FETCH_FAILED',
          `Too many redirects (more than ${opts.maxRedirects}).`,
        );
        return block(route, req, 'too many redirects', true, err);
      }
    }

    let safe;
    try {
      safe = await resolveSafeUrl(req.url(), {
        allowPrivate: opts.allowPrivate,
        lookup: opts.lookup,
      });
    } catch (err) {
      return block(route, req, err.message, isMain, err);
    }

    let res;
    try {
      res = await pinnedFetch({
        ...safe,
        method: req.method(),
        headers: await req.allHeaders(),
        body: req.postDataBuffer(),
        timeoutMs: opts.timeoutMs,
        maxBytes: opts.maxBytes,
      });
    } catch (err) {
      return block(route, req, err.message, isMain, err, 'failed');
    }

    const isRedirect = res.status >= 300 && res.status < 400;
    if (isMain && !isRedirect && !HTML_TYPES.test(res.headers['content-type'] ?? '')) {
      const type = (res.headers['content-type'] ?? 'unknown').split(';')[0];
      const err = new AppError(
        'UNSUPPORTED_INPUT',
        `That URL is not an HTML page (it is ${type}).`,
      );
      return block(route, req, 'not HTML', true, err);
    }

    return route
      .fulfill({ status: res.status, headers: res.headers, body: res.body })
      .catch(() => {});
  });

  return state;
}
