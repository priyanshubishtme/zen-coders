import { nanoid } from 'nanoid';
import { createSourceCache } from '../../repositories/sourceCache.js';
import { marksFor } from '../scanner/pins.js';
import { createScanLog } from '../scanLog.js';
import { AppError } from '../../utils/errors.js';
import { sha256 } from '../../utils/hash.js';
import { resolveSafeUrl } from '../../utils/urlSafety.js';
import { createInProcessQueue } from '../jobs/inProcess.js';
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

export function createOrchestrator({ scanner, repo, config, logger, lookup, verifier, sourceCache, llm }) {
  const jobs = createInProcessQueue({ logger });
  const idempotency = new Map();
  const sources = sourceCache ?? createSourceCache();
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

  async function runScan({ id, input, options, createdAtMs, inputHash }, attempt = 0) {
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
      const raw = await scanner.scan(input, options, { onStage: stageUpdate });
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
      const appError = err instanceof AppError ? err : null;
      if (!appError && attempt === 0) {
        log.warn({ err: err?.message }, 'scan crashed; retrying once');
        return runScan({ id, input, options, createdAtMs, inputHash }, 1);
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

  return {
    /** Validate, record, start in the background, and return immediately. */
    async createScan({ input, options }, { idempotencyKey } = {}) {
      if (idempotencyKey) {
        const hit = idempotency.get(idempotencyKey);
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
        tokenUsage: emptyTokenSummary(config.LLM_TOKEN_BUDGET_PER_SCAN),
        error: null,
        createdAt: new Date(createdAtMs).toISOString(),
        completedAt: null,
      };
      await repo.saveScan(scan);
      await repo.recordUsage({ scanId: scan.id, kind: 'scan', at: scan.createdAt });
      if (idempotencyKey) {
        idempotency.set(idempotencyKey, { id: scan.id, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
      }

      jobs.enqueue(
        () =>
          runScan({
            id: scan.id,
            input: scanInput,
            options,
            createdAtMs,
            inputHash: scan.inputHash,
          }),
        { label: scan.id },
      );
      return { id: scan.id, status: scan.status, stage: scan.stage };
    },

    async getScan(id) {
      const scan = await repo.getScan(id);
      if (!scan) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
      const live = scanLog.list(id);
      if (live.length) scan.events = live;
      return scan;
    },

    watchEvents(id, send) {
      return scanLog.subscribe(id, send);
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
      await this.getScan(id);
      const cached = sources.get(id);
      if (!cached?.source) {
        throw new AppError(
          'SOURCE_EXPIRED',
          'The scanned page is kept for one hour only and has expired. Scan it again to see the source.',
        );
      }
      return cached.source;
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
      return buildReport({ scan, repairs, verification: verifications.at(-1) ?? null });
    },

    /** Resolves when every in-flight scan has finished (tests, graceful shutdown). */
    idle: () => jobs.idle(),
  };
}
