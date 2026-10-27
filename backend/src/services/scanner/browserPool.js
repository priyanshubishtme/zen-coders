import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { AppError } from '../../utils/errors.js';

const LAUNCH_ARGS = [
  '--disable-dev-shm-usage',
  // Stop WebRTC from leaking or probing local network addresses.
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
];

export function isChromiumInstalled() {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

/**
 * One shared Chromium, one fresh context per scan, bounded concurrency and a
 * bounded wait queue. The context is always closed, even on timeout or crash.
 *
 * @param {{ maxContexts: number, queueMax: number, logger?: object,
 *   launch?: () => Promise<import('playwright').Browser> }} opts
 */
export function createBrowserPool({ maxContexts, queueMax, logger, launch }) {
  const doLaunch = launch ?? (() => chromium.launch({ args: LAUNCH_ARGS }));
  let browserPromise = null;
  let active = 0;
  const waiters = [];

  function getBrowser() {
    if (!browserPromise) {
      browserPromise = doLaunch()
        .then((browser) => {
          browser.on('disconnected', () => {
            logger?.warn('chromium disconnected; will relaunch on next scan');
            browserPromise = null;
          });
          return browser;
        })
        .catch((err) => {
          browserPromise = null;
          logger?.error({ err }, 'chromium failed to launch');
          throw new AppError(
            'BROWSER_UNAVAILABLE',
            'The scanner browser is not available. Run `npm run browsers:install`.',
          );
        });
    }
    return browserPromise;
  }

  async function acquire() {
    if (active < maxContexts) {
      active += 1;
      return;
    }
    if (waiters.length >= queueMax) {
      throw new AppError('SCANNER_BUSY', 'The scanner is busy. Try again in a moment.');
    }
    await new Promise((resolve) => waiters.push(resolve));
    active += 1;
  }

  function release() {
    active -= 1;
    waiters.shift()?.();
  }

  return {
    stats: () => ({ active, queued: waiters.length, maxContexts }),

    /**
     * Run `fn` with a fresh isolated context. Rejects with SCAN_TIMEOUT after
     * `timeoutMs`; the context is closed, which kills any hung page.
     * @template T
     * @param {(context: import('playwright').BrowserContext) => Promise<T>} fn
     * @param {{ timeoutMs: number, viewport?: { width: number, height: number } }} opts
     * @returns {Promise<T>}
     */
    async withContext(fn, { timeoutMs, viewport }) {
      await acquire();
      let context;
      let timer;
      try {
        const browser = await getBrowser();
        context = await browser.newContext({
          serviceWorkers: 'block',
          acceptDownloads: false,
          viewport: viewport ?? { width: 1280, height: 720 },
        });
        const work = fn(context);
        work.catch(() => {});
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new AppError('SCAN_TIMEOUT', `Scan exceeded ${timeoutMs} ms.`)),
            timeoutMs,
          );
        });
        return await Promise.race([work, timeout]);
      } finally {
        clearTimeout(timer);
        await context?.close().catch(() => {});
        release();
      }
    },

    async health() {
      if (browserPromise) {
        const browser = await browserPromise.catch(() => null);
        return browser?.isConnected() ? 'up' : 'down';
      }
      return isChromiumInstalled() ? 'up' : 'down';
    },

    async close() {
      const browser = await browserPromise?.catch(() => null);
      browserPromise = null;
      await browser?.close().catch(() => {});
    },
  };
}
