import { nanoid } from 'nanoid';
import { PLACEHOLDER_MARKER } from '../../schemas/api.js';
import { AppError } from '../../utils/errors.js';
import {
  applyLlmDraft,
  createContext,
  fillPlaceholder,
  proposeRepairs,
  restoreTemplate,
  toPublicRepair,
} from '../repair/index.js';
import { buildLlmTasks, isSafeDraft, naiveEstimateTokens } from '../llm/index.js';
import { normalize } from '../scanner/normalize.js';
import { computeScore } from '../scorer/index.js';
import { compare, subset } from '../verifier/compare.js';

const STATUS_BY_OUTCOME = {
  resolved: 'verified',
  'still-failing': 'failed',
  regressed: 'regressed',
  'not-applied': 'not-applied',
};

/** Shared preconditions: a finished scan whose source is still cached. */
async function load(repo, sourceCache, scanId) {
  const scan = await repo.getScan(scanId);
  if (!scan) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
  if (scan.status !== 'completed')
    throw new AppError('SCAN_NOT_READY', 'The scan has not finished yet.');
  const cached = sourceCache.get(scanId);
  if (!cached?.source) {
    throw new AppError(
      'SOURCE_EXPIRED',
      'The scanned page is kept for one hour only and has expired. Scan it again to get fixes.',
    );
  }
  return { scan, cached };
}

function applyOutcomes(repairs, outcomes) {
  return repairs.map((r) => {
    const o = outcomes.get(r.id);
    if (!o) return r;
    const verification = { outcome: o.outcome, detail: o.detail ?? null };
    if (o.preserve) return { ...r, verification };
    return { ...r, status: STATUS_BY_OUTCOME[o.outcome], verification };
  });
}

const tally = (repairs, scansRun) => ({
  verified: repairs.filter((r) => r.status === 'verified').length,
  failed: repairs.filter((r) => r.status === 'failed').length,
  regressed: repairs.filter((r) => r.status === 'regressed').length,
  notApplied: repairs.filter((r) => r.status === 'not-applied').length,
  needsInput: repairs.filter((r) => r.status === 'needs-input').length,
  manual: repairs.filter((r) => r.status === 'manual-review').length,
  scansRun,
});

/**
 * Repair -> verify -> score. Kept apart from scanning so each flow stays small.
 * @param {{ repo: object, sourceCache: object, verifier: object, logger: object,
 *   emptyTokens: () => object, llm?: object, config?: object }} deps
 */
export function createRepairFlow({ repo, sourceCache, verifier, logger, emptyTokens, llm, config }) {
  return {
    /** Propose one repair per issue and verify every automatic one in an offline re-scan. */
    async proposeRepairs(scanId, { violationIds, useLlm = true }, { ip = 'local' } = {}) {
      const { scan, cached } = await load(repo, sourceCache, scanId);
      const pool = [...scan.violations, ...scan.advisory];
      const wanted = violationIds ? pool.filter((v) => violationIds.includes(v.id)) : pool;
      const proposed = proposeRepairs({ scan, source: cached.source, violations: wanted });

      const naive = naiveEstimateTokens(wanted);
      let updated = proposed;
      let llmRes = null;
      if (useLlm && llm?.enabled) {
        const ctx = createContext({ source: cached.source, scan });
        const model = config?.LLM_MODEL_CHEAP || 'default';
        const tasks = buildLlmTasks(updated, { ctx, cached, model });
        llmRes = await llm.complete(tasks, {
          ip,
          scanBudget: config?.LLM_TOKEN_BUDGET_PER_SCAN,
        });
        updated = updated.map((r) => {
          const task = tasks.find((t) => t.repairIds.includes(r.id));
          const out = task && llmRes.results.get(task.key);
          if (!out?.text) return r;
          return applyLlmDraft(r, out.text, out.confidence, { scan, source: cached.source });
        });
      }

      const candidates = updated.filter((r) => r.status === 'proposed');
      let scansRun = 0;
      if (candidates.length) {
        const result = await verifier.verify({ scan, cached, repairs: candidates });
        updated = applyOutcomes(updated, result.outcomes);
        scansRun = result.scansRun;
      }

      const stored = await repo.listRepairs(scanId);
      const byViolation = new Map(stored.map((r) => [r.violationId, r]));
      for (const r of updated) byViolation.set(r.violationId, r);
      const repairs = [...byViolation.values()];
      await repo.saveRepairs(scanId, repairs);

      const summary = tally(repairs, scansRun);
      const deterministicFixes = repairs.filter((r) => r.strategy === 'deterministic').length;
      const used = llmRes?.usage?.totalTokens ?? 0;
      const tokenUsage = llmRes
        ? {
            provider: llm.name,
            model: llmRes.model ?? null,
            calls: llmRes.usage.calls,
            promptTokens: llmRes.usage.promptTokens,
            completionTokens: llmRes.usage.completionTokens,
            totalTokens: used,
            cacheHits: llmRes.cacheHits,
            estimatedCostUsd: llmRes.usage.estimatedCostUsd,
            budget: config?.LLM_TOKEN_BUDGET_PER_SCAN ?? 0,
            budgetExhausted: llmRes.budgetExhausted,
            deterministicFixes,
            dedupedItems: llmRes.dedupedItems,
            naiveEstimateTokens: naive,
            tokensSaved: Math.max(0, naive - used),
            tokensPerVerifiedFix: summary.verified ? used / summary.verified : null,
          }
        : {
            ...emptyTokens(),
            deterministicFixes,
            naiveEstimateTokens: naive,
            tokensSaved: naive,
            tokensPerVerifiedFix: summary.verified ? 0 : null,
          };
      llm?.recordScan?.({ naiveEstimateTokens: naive, deterministicFixes });
      await repo.updateScan(scanId, { tokenUsage });
      logger.child({ scanId }).info(summary, 'repairs proposed');
      return { scanId, repairs: repairs.map(toPublicRepair), summary, tokenUsage };
    },

    /** Apply the chosen repairs (with any filled-in placeholders), re-scan, and score before/after. */
    async verify(scanId, { repairIds, edits = [], acceptedRepairIds = [], rejectedRepairIds = [] }) {
      const started = Date.now();
      const { scan, cached } = await load(repo, sourceCache, scanId);
      const stored = await repo.listRepairs(scanId);
      const byId = new Map(stored.map((r) => [r.id, r]));
      const unknown = repairIds.filter((id) => !byId.has(id));
      if (unknown.length) {
        throw new AppError('VALIDATION_ERROR', 'Some repairs do not belong to this scan.', unknown);
      }
      const texts = new Map(edits.map((e) => [e.repairId, e.text]));
      const accepted = new Set(acceptedRepairIds);
      const rejected = new Set(rejectedRepairIds);

      const skipped = new Map();
      const candidates = [];
      for (const id of repairIds) {
        let r = byId.get(id);
        if (rejected.has(id) && r.strategy === 'llm') {
          r = restoreTemplate(r);
          byId.set(id, r);
          skipped.set(id, {
            outcome: 'not-applied',
            detail: 'The AI draft was rejected.',
            preserve: true,
          });
          continue;
        }
        if (r.strategy === 'manual') {
          skipped.set(id, { outcome: 'not-applied', detail: 'This issue needs a manual fix.' });
          continue;
        }
        if (r.strategy === 'llm' && !accepted.has(id)) {
          skipped.set(id, {
            outcome: 'not-applied',
            detail: 'Accept the AI draft first.',
          });
          continue;
        }
        if (r.strategy === 'llm') {
          r = { ...r, accepted: true };
          byId.set(id, r);
        }
        if (texts.has(id) && (r.placeholder || r.draft)) {
          const next = texts.get(id);
          if (r.strategy === 'llm' && !isSafeDraft(next, r.ruleId)) {
            skipped.set(id, {
              outcome: 'not-applied',
              detail: 'That wording is not allowed (plain words only, no HTML or URLs).',
            });
            continue;
          }
          r = fillPlaceholder(r, next, { scan, source: cached.source });
          byId.set(id, r);
        }
        const hasTodo =
          r._edits.some((e) => e.text.includes(PLACEHOLDER_MARKER)) ||
          (r.patch?.after ?? '').includes(PLACEHOLDER_MARKER);
        if (hasTodo) {
          skipped.set(id, { outcome: 'not-applied', detail: 'Fill in the placeholder first.' });
          continue;
        }
        candidates.push(r);
      }

      const result = await verifier.verify({ scan, cached, repairs: candidates });
      const outcomes = new Map([...result.outcomes, ...skipped]);
      const d = compare(result.baselineRaw, result.afterRaw);
      const bucketsOf = (raw, items) =>
        normalize(subset(raw, items), { inputHash: scan.inputHash });
      const flat = (b) => [...b.violations, ...b.advisory];

      const ids = repairIds.filter((id) => outcomes.get(id)?.outcome === 'resolved');
      const verification = {
        id: `ver_${nanoid(10)}`,
        scanId,
        status: ids.length === repairIds.length ? 'verified' : ids.length ? 'partial' : 'failed',
        repairs: repairIds.map((repairId) => ({ repairId, ...outcomes.get(repairId) })),
        resolved: flat(bucketsOf(result.baselineRaw, d.resolved)),
        remaining: flat(bucketsOf(result.afterRaw, d.remaining)),
        regressions: flat(bucketsOf(result.afterRaw, d.regressions)),
        manualReview: normalize(result.afterRaw, { inputHash: scan.inputHash }).manualReview,
        before: computeScore(result.baselineRaw, scan.options),
        after: computeScore(result.afterRaw, scan.options),
        patchedHtml: result.patchedHtml,
        scansRun: result.scansRun,
        durationMs: Date.now() - started,
        verifiedAt: new Date().toISOString(),
      };

      await repo.saveRepairs(scanId, applyOutcomes([...byId.values()], outcomes));
      await repo.saveVerification(verification);
      logger.child({ scanId }).info(
        {
          before: verification.before.value,
          after: verification.after.value,
          applied: ids.length,
        },
        'fixes applied',
      );
      return verification;
    },

    /** The patched page from the latest verification. */
    async getPatchedHtml(scanId) {
      const latest = (await repo.listVerifications(scanId)).at(-1);
      if (!latest)
        throw new AppError('NOT_FOUND', 'Apply fixes first; there is no patched page yet.');
      return latest.patchedHtml;
    },
  };
}
