import { nanoid } from 'nanoid';
import { AppError, NotImplementedError } from '../../utils/errors.js';
import { sha256 } from '../../utils/hash.js';
import { resolveSafeUrl } from '../../utils/urlSafety.js';
import { normalize } from '../scanner/normalize.js';

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
 *   config: object, logger: object, lookup?: Function }} deps
 */
export function createOrchestrator({ scanner, repo, config, logger, lookup }) {
  const running = new Set();

  async function runScan({ id, input, options, createdAtMs, inputHash }) {
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
      repo.updateScan(id, { status: 'scanning', stage, timings: { ...timings } }).catch(() => {});
    };

    try {
      log.info({ inputType: input.type }, 'scan started');
      const raw = await scanner.scan(input, options, { onStage: stageUpdate });
      Object.assign(timings, raw.timings);

      stageUpdate('normalizing');
      const t = Date.now();
      const buckets = normalize(raw, { inputHash });
      timings.normalizeMs = Date.now() - t;
      timings.totalMs = Date.now() - createdAtMs;

      await repo.updateScan(id, {
        status: 'completed',
        stage: 'done',
        ...buckets,
        headingOutline: raw.headingOutline.map(({ level, text, target }) => ({
          level,
          text,
          target: target.map((x) => (Array.isArray(x) ? x.join(' >>> ') : x)),
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
      if (!appError) log.error({ err }, 'scan crashed');
      else log.warn({ code: appError.code, msg: appError.message }, 'scan failed');
      timings.totalMs = Date.now() - createdAtMs;
      await repo.updateScan(id, {
        status: 'failed',
        stage: 'failed',
        timings,
        error: appError
          ? { code: appError.code, message: appError.message }
          : { code: 'INTERNAL', message: 'The scan failed unexpectedly.' },
        completedAt: new Date().toISOString(),
      });
    }
  }

  return {
    /** Validate, record, start in the background, and return immediately. */
    async createScan({ input, options }) {
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
        id: `s_${nanoid(12)}`,
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
        tokenUsage: emptyTokenSummary(config.LLM_TOKEN_BUDGET_PER_SCAN),
        error: null,
        createdAt: new Date(createdAtMs).toISOString(),
        completedAt: null,
      };
      await repo.saveScan(scan);
      await repo.recordUsage({ scanId: scan.id, kind: 'scan', at: scan.createdAt });

      const job = runScan({
        id: scan.id,
        input: scanInput,
        options,
        createdAtMs,
        inputHash: scan.inputHash,
      }).finally(() => running.delete(job));
      running.add(job);
      return { id: scan.id, status: scan.status, stage: scan.stage };
    },

    async getScan(id) {
      const scan = await repo.getScan(id);
      if (!scan) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
      return scan;
    },

    async getUsage() {
      const summary = await repo.usageSummary();
      return {
        since: summary.since,
        scans: summary.scans,
        verifiedFixes: 0,
        tokens: emptyTokenSummary(config.LLM_TOKEN_BUDGET_PER_SCAN),
        rateLimiter: { queued: 0, rpmRemaining: config.LLM_RPM, tpmRemaining: config.LLM_TPM },
      };
    },

    proposeRepairs: async () => {
      throw new NotImplementedError('POST /scans/:id/repairs');
    },
    verify: async () => {
      throw new NotImplementedError('POST /scans/:id/verify');
    },
    getReport: async () => {
      throw new NotImplementedError('GET /scans/:id/report');
    },

    /** Resolves when every in-flight scan has finished (tests, graceful shutdown). */
    idle: () => Promise.allSettled([...running]),
  };
}
