import { nanoid } from 'nanoid';
import { createSourceCache } from '../../repositories/sourceCache.js';
import { marksFor } from '../scanner/pins.js';
import { createScanLog } from '../scanLog.js';
import { AppError } from '../../utils/errors.js';
import { sha256 } from '../../utils/hash.js';
import { resolveSafeUrl } from '../../utils/urlSafety.js';
import { canWrite } from '../access/decide.js';
import { executeCrawl } from '../crawl/execute.js';
import { pageFileName, zipStore } from '../export/zipStore.js';
import { createJobQueue } from '../jobs/queue.js';
import { tierCaps } from '../quota/caps.js';
import { createMeter } from '../quota/meter.js';
import { stateForHost } from '../vault/authState.js';
import { buildReport } from '../report/index.js';
import { toPublicRepair } from '../repair/index.js';
import { normalize } from '../scanner/normalize.js';
import { computeScore } from '../scorer/index.js';
import { createVerifier } from '../verifier/index.js';
import { createRepairFlow } from './repairFlow.js';

/** URL-safe, unguessable. `s_` + 21 chars from nanoid. */
export const SCAN_ID_SIZE = 21;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** At least 3 control characters making up over 1% of the input means this is not HTML text. */
const MAX_CONTROL_RATIO = 0.01;
const MIN_CONTROL_CHARS = 3;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g;

function prepareHtml(html, maxBytes) {
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > maxBytes) {
    throw new AppError('PAYLOAD_TOO_LARGE', `HTML is ${bytes} bytes; the limit is ${maxBytes}.`);
  }
  const controls = html.match(CONTROL_CHARS)?.length ?? 0;
  if (controls >= MIN_CONTROL_CHARS && controls / html.length > MAX_CONTROL_RATIO) {
    throw new AppError('UNSUPPORTED_INPUT', 'That looks like binary data, not HTML.');
  }
  const clean = html.replaceAll('\u0000', '');
  if (!clean.trim()) throw new AppError('UNSUPPORTED_INPUT', 'The HTML is empty.');
  return { clean, bytes };
}

export function emptyTokenSummary(budget) {
  return {
    provider: 'none',
    model: null,
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheHits: 0,
    estimatedCostUsd: null,
    budget,
    budgetExhausted: false,
    deterministicFixes: 0,
    dedupedItems: 0,
    naiveEstimateTokens: 0,
    tokensSaved: 0,
    tokensPerVerifiedFix: null,
  };
}

/**
 * The only module that sequences the pipeline. Controllers call it; services
 * never call each other directly.
 *
 * @param {{ scanner: object, repo: import('../../repositories/scanRepository.js').ScanRepository,
 *   config: object, logger: object, lookup?: Function, verifier?: object, sourceCache?: object,
 *   llm?: object }} deps
 */
const STAGE_LOG = {
  loading: ['render', 'Loading the page'],
  rendering: ['wait', 'Waiting for the network to settle'],
  checking: ['axe', 'Running axe-core'],
  normalizing: ['score', 'Scoring the page'],
};

export function createOrchestrator({
  scanner,
  repo,
  config,
  logger,
  lookup,
  verifier,
  sourceCache,
  llm,
  accounts,
  vault,
  meter: meterIn,
}) {
  const meter =
    meterIn ?? createMeter({ ceiling: config.LLM_TOKEN_DAILY_CEILING ?? 0 });
  let runJob = async () => {};
  const jobs = createJobQueue({
    redisUrl: config.REDIS_URL,
    logger,
    concurrency: config.BROWSER_MAX_CONTEXTS,
    handler: (id, signal) => runJob(id, signal),
  });
  const idempotency = new Map();
  const sources =
    sourceCache ?? createSourceCache({ maxBytes: config.CACHE_MAX_BYTES ?? 256 * 1024 * 1024 });
  const scanLog = createScanLog();
  const note = (scanId, stage, message, ms = null) => scanLog.publish(scanId, { stage, message, ms });
  const repairFlow = createRepairFlow({
    repo,
    sourceCache: sources,
    verifier: verifier ?? createVerifier({ scanner }),
    logger,
    emptyTokens: () => emptyTokenSummary(config.LLM_TOKEN_BUDGET_PER_SCAN),
    llm,
    config,
    onEvent: note,
  });

  async function runScan({ id, input, options, createdAtMs, inputHash, signal, auth }, attempt = 0) {
    const log = logger.child({ scanId: id });
    const timings = {
      queueMs: null,
      loadMs: null,
      renderMs: null,
      axeMs: null,
      checksMs: null,
      normalizeMs: null,
      totalMs: null,
    };
    const stageUpdate = (stage) => {
      if (stage === 'loading') timings.queueMs = Date.now() - createdAtMs;
      log.debug({ stage }, 'scan stage');
      const mapped = STAGE_LOG[stage];
      if (mapped) note(id, mapped[0], mapped[1], Date.now() - createdAtMs);
      repo.updateScan(id, { status: 'scanning', stage, timings: { ...timings } }).catch(() => {});
    };

    try {
      log.info({ inputType: input.type }, 'scan started');
      const raw = await scanner.scan(input, options, {
        onStage: stageUpdate,
        signal,
        waitFor: options.waitFor,
        storageState: auth && input.type === 'url' ? stateForHost(auth, new URL(input.url).host) : undefined,
      });
      Object.assign(timings, raw.timings);

      stageUpdate('normalizing');
      const t = Date.now();
      const buckets = normalize(raw, { inputHash });
      const score = computeScore(raw, options);
      timings.normalizeMs = Date.now() - t;
      timings.totalMs = Date.now() - createdAtMs;

      if (raw.source) {
        sources.set(id, {
          source: raw.source,
          resources: raw.resources,
          mainUrl: raw.page.finalUrl,
          shots: raw.screenshot ? { before: raw.screenshot } : {},
        });
      } else if (sources.get(id)?.pending) {
        sources.drop(id);
      }
      const marks = marksFor(buckets.violations, raw.pinFrames ?? []);
      if (config.SCREENSHOTS) {
        note(
          id,
          'screenshot',
          raw.screenshot
            ? `Before screenshot captured (${marks.filter((m) => m.place === 'pin').length} pins)`
            : 'Before screenshot skipped',
        );
      }
      note(id, 'score', `Score ${score.value ?? 'N/A'}`, Date.now() - createdAtMs);
      await repo.updateScan(id, {
        status: 'completed',
        stage: 'done',
        ...buckets,
        score,
        events: scanLog.list(id),
        marks,
        viewport: raw.viewport ?? null,
        shots: { before: Boolean(raw.screenshot), after: false },
        keyboard: raw.keyboard?.checks ?? [],
        renderWarning: raw.renderWarning ?? null,
        headingOutline: raw.headingOutline.map(({ level, text, target, style }) => ({
          level,
          text,
          target: target.map((x) => (Array.isArray(x) ? x.join(' >>> ') : x)),
          style: style ?? null,
        })),
        page: raw.page,
        network: raw.network,
        engine: { axeVersion: raw.axeVersion },
        timings,
        completedAt: new Date().toISOString(),
      });
      if (auth) sources.expireIn(id, config.AUTH_RETENTION_MS);
      log.info(
        {
          violations: buckets.violations.length,
          advisory: buckets.advisory.length,
          manualReview: buckets.manualReview.length,
          totalMs: timings.totalMs,
        },
        'scan completed',
      );
    } catch (err) {
      if (signal?.aborted) {
        note(id, 'failed', 'Cancelled.', Date.now() - createdAtMs);
        await repo.updateScan(id, {
          status: 'failed',
          stage: 'failed',
          error: { code: 'SCAN_TIMEOUT', message: 'Cancelled.' },
          events: scanLog.list(id),
          completedAt: new Date().toISOString(),
        });
        return;
      }
      const appError = err instanceof AppError ? err : null;
      if (!appError && attempt === 0) {
        log.warn({ err: err?.message }, 'scan crashed; retrying once');
        return runScan({ id, input, options, createdAtMs, inputHash, signal, auth }, 1);
      }
      if (!appError) log.error({ err }, 'scan crashed');
      else log.warn({ code: appError.code, msg: appError.message }, 'scan failed');
      timings.totalMs = Date.now() - createdAtMs;
      note(id, 'failed', appError?.message ?? 'The scan failed unexpectedly.', timings.totalMs);
      await repo.updateScan(id, {
        status: 'failed',
        stage: 'failed',
        timings,
        error: appError
          ? { code: appError.code, message: appError.message }
          : { code: 'INTERNAL', message: 'The scan failed unexpectedly.' },
        events: scanLog.list(id),
        completedAt: new Date().toISOString(),
      });
    }
  }

  runJob = async (id, signal) => {
    const scan = await repo.getScan(id);
    if (!scan || scan.status === 'completed' || scan.status === 'failed') return;
    const auth = await vault?.read(id);
    if (scan.options?.crawl) {
      try {
        await executeCrawl({
          scanId: id,
          seedUrl: scan.input.url,
          options: scan.options,
          config,
          scanner,
          repo,
          sources,
          note,
          signal,
          lookup,
          plan: scan.plan || 'free',
          ownerId: scan.ownerId,
          meter,
          authMaterial: auth,
          listEvents: () => scanLog.list(id),
        });
      } catch (err) {
        if (signal?.aborted) {
          note(id, 'failed', 'Cancelled.');
          await repo.updateScan(id, {
            status: 'failed',
            stage: 'failed',
            error: { code: 'SCAN_TIMEOUT', message: 'Cancelled.' },
            events: scanLog.list(id),
            completedAt: new Date().toISOString(),
          });
          return;
        }
        const appError = err instanceof AppError ? err : null;
        if (!appError) logger?.error?.({ err, scanId: id }, 'crawl crashed');
        note(id, 'failed', appError?.message ?? 'The crawl failed unexpectedly.');
        await repo.updateScan(id, {
          status: 'failed',
          stage: 'failed',
          error: appError
            ? { code: appError.code, message: appError.message }
            : { code: 'INTERNAL', message: 'The crawl failed unexpectedly.' },
          events: scanLog.list(id),
          completedAt: new Date().toISOString(),
        });
      }
      return;
    }
    const input =
      scan.input.type === 'url'
        ? { type: 'url', url: scan.input.url }
        : { type: 'html', html: sources.get(id)?.source ?? '' };
    await runScan({
      id,
      input,
      options: scan.options,
      createdAtMs: Date.parse(scan.createdAt),
      inputHash: scan.inputHash,
      signal,
      auth,
    });
  };

  return {
    /** Validate, record, start in the background, and return immediately. */
    async createScan({ input, options, auth }, { idempotencyKey, actor, ip = 'local' } = {}) {
      const scopedKey = idempotencyKey ? `${actor?.userId ?? 'anon'}:${idempotencyKey}` : undefined;
      if (scopedKey) {
        const hit = idempotency.get(scopedKey);
        if (hit && hit.expiresAt > Date.now()) {
          const existing = await repo.getScan(hit.id);
          if (existing) return { id: existing.id, status: existing.status, stage: existing.stage };
        }
      }
      let scanInput;
      let publicInput;
      let hashSource;
      if (input.type === 'html') {
        const { clean, bytes } = prepareHtml(input.html, config.MAX_HTML_BYTES);
        scanInput = { type: 'html', html: clean };
        publicInput = { type: 'html', bytes };
        hashSource = `html\n${clean}`;
      } else {
        const { url } = await resolveSafeUrl(input.url, {
          allowPrivate: config.ALLOW_PRIVATE_URLS,
          lookup,
        });
        scanInput = { type: 'url', url: url.href };
        publicInput = { type: 'url', url: url.href };
        hashSource = `url\n${url.href}`;
      }
      if (options?.crawl) {
        if (!actor) throw new AppError('AUTH_REQUIRED', 'Sign in to crawl a site.');
        if (input.type !== 'url') throw new AppError('VALIDATION_ERROR', 'A crawl needs a URL.');
      }
      if (auth) {
        if (!actor) throw new AppError('AUTH_REQUIRED', 'Sign in to scan a page that needs a login.');
        if (!vault?.enabled) throw new AppError('VALIDATION_ERROR', 'Authenticated scanning is disabled: no key.');
        if (JSON.stringify(auth).length > 200_000) {
          throw new AppError('PAYLOAD_TOO_LARGE', 'The login state is too large.');
        }
      }
      if (config.QUOTAS_ENABLED && meter) {
        if (!actor) {
          const used = await meter.scansUsed(`ip:${ip}`);
          if (config.LOGGED_OUT_SCANS_DAY > 0 && used >= config.LOGGED_OUT_SCANS_DAY) {
            throw new AppError('RATE_LIMITED', 'The daily limit for signed-out scans has been reached.', {
              retryAfterSec: 3600,
            });
          }
        } else {
          const caps = tierCaps(config, actor.plan);
          const used = await meter.scansUsed(actor.userId);
          if (used >= caps.scans) {
            throw new AppError('RATE_LIMITED', 'The daily scan limit has been reached.', { retryAfterSec: 3600 });
          }
        }
      }

      const createdAtMs = Date.now();
      const scan = {
        id: `s_${nanoid(SCAN_ID_SIZE)}`,
        status: 'queued',
        stage: 'queued',
        input: publicInput,
        inputHash: sha256(hashSource),
        options,
        violations: [],
        manualReview: [],
        advisory: [],
        headingOutline: [],
        page: null,
        network: null,
        engine: null,
        timings: {
          queueMs: null,
          loadMs: null,
          renderMs: null,
          axeMs: null,
          checksMs: null,
          normalizeMs: null,
          totalMs: null,
        },
        score: null,
        events: [],
        marks: [],
        viewport: null,
        shots: { before: false, after: false },
        ownerId: actor?.userId ?? null,
        access: actor ? 'private' : 'capability',
        authUsed: Boolean(auth),
        pinnedHost: null,
        partial: false,
        pages: [],
        keyboard: [],
        renderWarning: null,
        plan: actor?.plan ?? 'free',
        tokenUsage: emptyTokenSummary(config.LLM_TOKEN_BUDGET_PER_SCAN),
        error: null,
        createdAt: new Date(createdAtMs).toISOString(),
        completedAt: null,
      };
      await repo.saveScan(scan);
      await repo.recordUsage({ scanId: scan.id, kind: 'scan', at: scan.createdAt });
      if (scopedKey) {
        idempotency.set(scopedKey, { id: scan.id, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
      }
      if (scanInput.type === 'html') {
        sources.set(scan.id, {
          source: scanInput.html,
          resources: new Map(),
          mainUrl: null,
          shots: {},
          pending: true,
        });
      }
      if (auth) await vault.put(scan.id, auth);
      if (actor) await accounts?.noteScan(actor.userId, scan.id);
      await meter.addScans(actor?.userId ?? `ip:${ip}`);

      jobs.enqueue((signal) => runJob(scan.id, signal), {
        label: scan.id,
        onSettled: () => vault?.delete(scan.id),
      });
      return { id: scan.id, status: scan.status, stage: scan.stage };
    },

    async getScan(id) {
      const scan = await repo.getScan(id);
      if (!scan) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
      const live = scanLog.list(id);
      if (live.length) scan.events = live;
      return scan;
    },

    watchEvents(id, send, afterId) {
      return scanLog.subscribe(id, send, { afterId });
    },

    cancelScan(id) {
      jobs.cancel(id);
      return { id, status: 'cancelling' };
    },

    async getScreenshot(id, which) {
      await this.getScan(id);
      const shot = sources.getShot(id, which);
      if (!shot) {
        throw new AppError('NOT_FOUND', 'That screenshot is not available. It may have expired.');
      }
      return shot;
    },

    async getSource(id) {
      const scan = await this.getScan(id);
      const cached = sources.get(id);
      if (!cached?.source) {
        throw new AppError(
          'SOURCE_EXPIRED',
          scan.authUsed
            ? 'This authenticated scan expired 15 minutes after it finished. Scan it again to see the source.'
            : 'The scanned page is kept for one hour only and has expired. Scan it again to see the source.',
        );
      }
      return cached.source;
    },

    async getZip(id) {
      const scan = await this.getScan(id);
      if (scan.authUsed && !sources.get(id)) {
        throw new AppError(
          'SOURCE_EXPIRED',
          'This authenticated scan expired 15 minutes after it finished. The download is no longer available.',
        );
      }
      const verification = (await repo.listVerifications(id)).at(-1);
      const files = [];
      const manifestPages = [];
      let total = 0;
      let n = 0;
      const finished = (scan.pages ?? []).filter((page) => page.status === 'completed');
      const rows = finished.length ? finished : [{ url: scan.page?.finalUrl, cacheIndex: null }];
      for (const page of rows) {
        const patched = verification?.pageFiles?.find((item) => item.url === page.url)?.html;
        const cached =
          page.cacheIndex != null ? sources.get(`${id}#${page.cacheIndex}`)?.source : sources.get(id)?.source;
        const html = patched || cached;
        if (!html) continue;
        total += Buffer.byteLength(html);
        const name = pageFileName(n);
        n += 1;
        files.push({ name, data: html });
        manifestPages.push({
          url: page.url,
          file: name,
          patches: (verification?.repairs ?? []).map((item) => ({
            repairId: item.repairId,
            outcome: item.outcome ?? null,
          })),
          verification: verification?.status ?? 'not-run',
        });
      }
      const manifest = JSON.stringify({ scanId: id, pages: manifestPages }, null, 2);
      total += Buffer.byteLength(manifest);
      if (total > (config.ZIP_MAX_BYTES ?? 20 * 1024 * 1024)) {
        throw new AppError(
          'PAYLOAD_TOO_LARGE',
          'The download is larger than 20 MB, so it was not created. Download one page at a time instead.',
        );
      }
      if (!files.length) {
        throw new AppError('SOURCE_EXPIRED', 'The scanned pages are no longer available. Scan the site again.');
      }
      files.push({ name: 'manifest.json', data: manifest });
      return zipStore(files);
    },

    async createShare(id, actor, { expiresAt } = {}) {
      const scan = await this.getScan(id);
      if (!scan.ownerId) throw new AppError('AUTH_REQUIRED', 'Sign in to create a share link.');
      if (!canWrite(scan, actor)) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
      if (scan.authUsed) throw new AppError('VALIDATION_ERROR', 'Authenticated scans cannot be shared.');
      const exp = expiresAt ?? new Date(Date.now() + config.SCAN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const token = await accounts.createShare({ scanId: id, userId: actor.userId, expiresAt: exp });
      return { path: `/shares/${token}`, expiresAt: exp };
    },

    async listScans(ids) {
      return repo.listByIds(ids);
    },

    async getUsage() {
      const summary = await repo.usageSummary();
      const stats = llm?.limiterStats?.() ?? {};
      return {
        since: summary.since,
        scans: summary.scans,
        verifiedFixes: 0,
        tokens: llm?.usageRollup?.() ?? emptyTokenSummary(config.LLM_TOKEN_BUDGET_PER_SCAN),
        rateLimiter: {
          queued: stats.queued ?? 0,
          rpmRemaining: stats.rpmRemaining ?? config.LLM_RPM,
          tpmRemaining: stats.tpmRemaining ?? config.LLM_TPM,
        },
      };
    },

    async proposeRepairs(scanId, body, ctx) {
      const result = await repairFlow.proposeRepairs(scanId, body, ctx);
      const events = scanLog.list(scanId);
      if (events.length) await repo.updateScan(scanId, { events });
      return result;
    },
    async verify(scanId, body) {
      const started = Date.now();
      note(scanId, 'verify', 'Re-scanning the patched copy');
      const result = await repairFlow.verify(scanId, body);
      note(
        scanId,
        'score',
        `Score ${result.before?.value ?? 'N/A'} → ${result.after?.value ?? 'N/A'}`,
        Date.now() - started,
      );
      if (config.SCREENSHOTS && scanner.captureShot && result.patchedHtml) {
        const jpeg = await scanner.captureShot(result.patchedHtml);
        if (jpeg && sources.setShot(scanId, 'after', jpeg)) {
          const current = await repo.getScan(scanId);
          await repo.updateScan(scanId, {
            shots: { before: Boolean(current?.shots?.before), after: true },
          });
          note(scanId, 'screenshot', 'After screenshot captured');
        } else {
          note(scanId, 'screenshot', 'After screenshot skipped');
        }
      }
      const events = scanLog.list(scanId);
      if (events.length) await repo.updateScan(scanId, { events });
      return result;
    },
    getPatchedHtml: (scanId) => repairFlow.getPatchedHtml(scanId),
    async getReport(scanId) {
      const scan = await repo.getScan(scanId);
      if (!scan) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
      const repairs = (await repo.listRepairs(scanId)).map(toPublicRepair);
      const verifications = await repo.listVerifications(scanId);
      return buildReport({
        scan,
        repairs,
        verification: verifications.at(-1) ?? null,
        screenshotsAvailable: Boolean(sources.getShot(scanId, 'before') || sources.getShot(scanId, 'after')),
      });
    },

    /** Resolves when every in-flight scan has finished (tests, graceful shutdown). */
    idle: () => jobs.idle(),
  };
}
