import { AxeBuilder } from '@axe-core/playwright';
import { AppError } from '../../utils/errors.js';
import { createBrowserPool } from './browserPool.js';
import { resolveAxeTargets, runChecks } from './checks/index.js';
import { installNetworkGuard } from './networkGuard.js';
import { frameKey, mainSelector, rectToPin } from './pins.js';

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

/** Attach our element id and any verification marker (data-afx-v) to every axe node. */
async function annotate(page, results) {
  const targets = results.flatMap((r) => r.nodes.map((n) => n.target));
  const ids = await resolveAxeTargets(page, targets);
  let i = 0;
  return results.map((r) => ({
    ...r,
    nodes: r.nodes.map((n) => {
      const [afxId, marker] = ids[i++] ?? [null, null];
      return { ...n, afxId, marker };
    }),
  }));
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
   * @param {{ onStage?: (stage: ScanStage) => void,
   *   replay?: { resources: Map<string, object>, mainHtml?: string } }} [hooks]
   *   replay: never touch the network; serve the page from captured responses (verification).
   * @returns {Promise<RawScanResult>}
   */
  const viewport = { width: config.VIEWPORT_WIDTH, height: config.VIEWPORT_HEIGHT };

  async function jpegOf(page) {
    const buf = await page.screenshot({
      type: 'jpeg',
      quality: config.SCREENSHOT_QUALITY,
      fullPage: false,
    });
    if (buf.length > config.SCREENSHOT_MAX_BYTES) return null;
    return buf;
  }

  /** Bounding boxes for axe nodes, in viewport fractions. Never throws. */
  async function measure(page, rules) {
    const specs = [];
    for (const rule of rules) {
      for (const node of rule.nodes ?? []) {
        specs.push({
          key: frameKey(rule.id, node.target),
          selector: mainSelector(node.target),
        });
      }
    }
    if (!specs.length) return [];
    const measured = await page.evaluate((items) => {
      // Runs in the page, where document exists.
      const root = globalThis.document;
      return items.map((item) => {
        if (!item.selector) return { key: item.key, place: 'frame' };
        let el;
        try {
          el = root.querySelector(item.selector);
        } catch {
          return { key: item.key, place: 'unmeasured' };
        }
        if (!el) return { key: item.key, place: 'unmeasured' };
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || '')
          .trim()
          .slice(0, 160);
        return {
          key: item.key,
          name,
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        };
      });
    }, specs);
    return measured.map((item) => {
      if (item.place) return { key: item.key, place: item.place, name: '', role: '' };
      const pin = rectToPin(item.rect, viewport);
      return { key: item.key, name: item.name ?? '', role: item.role ?? '', ...pin };
    });
  }

  async function scan(input, options, { onStage = () => {}, replay } = {}) {
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
          replay,
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

        let screenshot = null;
        let pinFrames = [];
        if (config.SCREENSHOTS && !replay) {
          try {
            pinFrames = await measure(page, violations);
            screenshot = await jpegOf(page);
            if (!screenshot) pinFrames = [];
          } catch (err) {
            screenshot = null;
            pinFrames = [];
            deps.logger?.warn({ err: err?.message }, 'screenshot skipped');
          }
        }

        return {
          axeVersion: axe.testEngine.version,
          violations,
          incomplete,
          passes: axe.passes.map((r) => ({ id: r.id, tags: r.tags, count: r.nodes.length })),
          findings: checks.findings,
          headingOutline: checks.outline,
          /** The text repairs patch: pasted HTML, or the HTML the server sent. */
          source: input.type === 'html' ? input.html : guard.mainBody,
          /** Responses captured for offline replay during verification. */
          resources: guard.captured,
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
          screenshot,
          pinFrames,
          viewport,
        };
      },
      { timeoutMs: config.SCAN_TIMEOUT_MS, viewport },
    );
  }

  /** Render patched HTML and return a JPEG of the same viewport, or null. */
  async function captureShot(html) {
    if (!config.SCREENSHOTS) return null;
    try {
      return await pool.withContext(
        async (context) => {
          const page = await context.newPage();
          await page.setContent(html, { waitUntil: 'load', timeout: 8_000 });
          return jpegOf(page);
        },
        { timeoutMs: 15_000, viewport },
      );
    } catch (err) {
      deps.logger?.warn({ err: err?.message }, 'after screenshot skipped');
      return null;
    }
  }

  return {
    scan,
    captureShot,
    health: () => pool.health(),
    stats: () => pool.stats(),
    close: () => pool.close(),
  };
}
