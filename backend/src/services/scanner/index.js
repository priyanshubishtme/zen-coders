import { AxeBuilder } from '@axe-core/playwright';
import { AppError } from '../../utils/errors.js';
import { createBrowserPool } from './browserPool.js';
import { resolveAxeTargets, runChecks } from './checks/index.js';
import { installNetworkGuard } from './networkGuard.js';

/** axe tags for the default WCAG 2.2 AA target. */
export function axeTags({ includeAAA, includeBestPractice }) {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
  if (includeAAA) tags.push('wcag2aaa', 'wcag21aaa', 'wcag22aaa');
  if (includeBestPractice) tags.push('best-practice');
  return tags;
}

/**
 * @typedef {object} RawScanResult
 * @property {string} axeVersion
 * @property {object[]} violations   axe results.violations, nodes annotated with afxId
 * @property {object[]} incomplete   axe results.incomplete (needs review), same annotation
 * @property {object[]} findings     our deterministic checks
 * @property {object[]} headingOutline
 * @property {{ finalUrl: string | null, title: string | null, settled: boolean }} page
 * @property {{ requests: number, blocked: number, blockedSamples: object[] }} network
 * @property {{ loadMs: number, renderMs: number, axeMs: number, checksMs: number }} timings
 *
 * @typedef {'loading' | 'rendering' | 'checking'} ScanStage
 */

function mapNavigationError(err, guard) {
  if (guard.mainError) return guard.mainError;
  if (err instanceof AppError) return err;
  if (err?.name === 'TimeoutError')
    return new AppError('SCAN_TIMEOUT', 'The page took too long to load.');
  return new AppError('FETCH_FAILED', 'The page could not be loaded.');
}

async function annotate(page, results) {
  const targets = results.flatMap((r) => r.nodes.map((n) => n.target));
  const ids = await resolveAxeTargets(page, targets);
  let i = 0;
  return results.map((r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, afxId: ids[i++] })) }));
}

/**
 * @param {object} config
 * @param {{ pool?: ReturnType<typeof createBrowserPool>, lookup?: Function, logger?: object }} [deps]
 */
export function createScanner(config, deps = {}) {
  const pool =
    deps.pool ??
    createBrowserPool({
      maxContexts: config.BROWSER_MAX_CONTEXTS,
      queueMax: config.SCAN_QUEUE_MAX,
      logger: deps.logger,
    });

  /**
   * @param {{ type: 'html', html: string } | { type: 'url', url: string }} input
   * @param {{ includeAAA: boolean, includeBestPractice: boolean }} options
   * @param {{ onStage?: (stage: ScanStage) => void }} [hooks]
   * @returns {Promise<RawScanResult>}
   */
  async function scan(input, options, { onStage = () => {} } = {}) {
    return pool.withContext(
      async (context) => {
        const page = await context.newPage();
        const guard = await installNetworkGuard(context, {
          allowPrivate: config.ALLOW_PRIVATE_URLS,
          lookup: deps.lookup,
          maxRequests: config.MAX_SUBREQUESTS,
          maxRedirects: config.MAX_REDIRECTS,
          maxBytes: config.MAX_RESPONSE_BYTES,
          timeoutMs: config.SUBREQUEST_TIMEOUT_MS,
          isMainDocument: (req) => req.isNavigationRequest() && req.frame() === page.mainFrame(),
        });
        page.on('dialog', (d) => d.dismiss().catch(() => {}));
        // Only popups opened by the scanned page; AxeBuilder opens its own helper page.
        page.on('popup', (p) => p.close().catch(() => {}));

        const navTimeout = config.SCAN_TIMEOUT_MS;
        let t = Date.now();
        const timings = {};

        onStage('loading');
        try {
          if (input.type === 'html') {
            await page.setContent(input.html, { waitUntil: 'load', timeout: navTimeout });
          } else {
            const res = await page.goto(input.url, { waitUntil: 'load', timeout: navTimeout });
            if (guard.mainError) throw guard.mainError;
            if (res && res.status() >= 400) {
              throw new AppError('FETCH_FAILED', `The site responded with HTTP ${res.status()}.`);
            }
          }
        } catch (err) {
          throw mapNavigationError(err, guard);
        }
        timings.loadMs = Date.now() - t;

        onStage('rendering');
        t = Date.now();
        const settled = await page
          .waitForLoadState('networkidle', { timeout: config.NETWORK_IDLE_MAX_MS })
          .then(
            () => true,
            () => false,
          );
        timings.renderMs = Date.now() - t;

        onStage('checking');
        t = Date.now();
        const axe = await new AxeBuilder({ page }).withTags(axeTags(options)).analyze();
        const [violations, incomplete] = await Promise.all([
          annotate(page, axe.violations),
          annotate(page, axe.incomplete),
        ]);
        timings.axeMs = Date.now() - t;

        t = Date.now();
        const checks = await runChecks(page);
        timings.checksMs = Date.now() - t;

        return {
          axeVersion: axe.testEngine.version,
          violations,
          incomplete,
          findings: checks.findings,
          headingOutline: checks.outline,
          page: {
            finalUrl: input.type === 'url' ? page.url() : null,
            title: (await page.title()) || null,
            settled,
          },
          network: {
            requests: guard.requests,
            blocked: guard.blocked,
            blockedSamples: guard.blockedSamples,
          },
          timings,
        };
      },
      { timeoutMs: config.SCAN_TIMEOUT_MS },
    );
  }

  return {
    scan,
    health: () => pool.health(),
    stats: () => pool.stats(),
    close: () => pool.close(),
  };
}
