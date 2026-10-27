import { pinnedFetch } from '../../utils/pinnedFetch.js';
import { resolveSafeUrl } from '../../utils/urlSafety.js';

/**
 * Tiny robots.txt reader: the `User-agent: *` group only.
 * A missing or unreadable file allows the crawl at the default pace.
 * @param {string} body
 */
export function parseRobots(body) {
  const disallow = [];
  let delayMs = 0;
  let star = false;
  for (const line of String(body ?? '').split(/\r?\n/)) {
    const raw = line.split('#')[0].trim();
    if (!raw) {
      star = false;
      continue;
    }
    const split = raw.indexOf(':');
    if (split < 0) continue;
    const key = raw.slice(0, split).trim().toLowerCase();
    const value = raw.slice(split + 1).trim();
    if (key === 'user-agent') {
      star = value === '*';
    } else if (star && key === 'disallow' && value) {
      disallow.push(value);
    } else if (star && key === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) delayMs = Math.max(delayMs, seconds * 1000);
    }
  }
  return {
    delayMs,
    /** @param {string} url */
    allowed(url) {
      let path = '/';
      try {
        path = new URL(url).pathname || '/';
      } catch {
        return false;
      }
      return !disallow.some((rule) => path === rule || path.startsWith(rule));
    },
  };
}

const OPEN = { delayMs: 0, allowed: () => true };

/**
 * Fetch /robots.txt one hop at a time so every redirect is checked for SSRF.
 * Failure means "no opinion", not "the crawl failed".
 */
export async function loadRobots(seedUrl, { allowPrivate, lookup, timeoutMs }) {
  let current = new URL('/robots.txt', seedUrl).href;
  try {
    for (let hop = 0; hop < 3; hop += 1) {
      const safe = await resolveSafeUrl(current, { allowPrivate, lookup });
      const res = await pinnedFetch({ ...safe, method: 'GET', timeoutMs, maxBytes: 100_000 });
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        current = new URL(res.headers.location, current).href;
        continue;
      }
      if (res.status !== 200) return OPEN;
      return parseRobots(res.body.toString('utf8'));
    }
  } catch {
    return OPEN;
  }
  return OPEN;
}
