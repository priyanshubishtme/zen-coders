/**
 * API client. Shapes mirror backend/src/schemas (see docs/04-api-contract.md).
 *
 * @typedef {'critical' | 'serious' | 'moderate' | 'minor'} Impact
 * @typedef {{ sc: string, name: string, level: 'A' | 'AA' | 'AAA' | null, url: string }} WcagRef
 * @typedef {{ id: string, ruleId: string, source: 'axe' | 'accessfix',
 *   outcome: 'violation' | 'needs-review', category: 'wcag' | 'best-practice', impact: Impact,
 *   wcag: { criteria: string[], level: string | null, refs: WcagRef[] },
 *   title: string, explanation: string, whoItAffects: string, helpUrl: string | null,
 *   node: { target: string[], html: string, failureSummary: string | null } }} Violation
 * @typedef {'queued' | 'loading' | 'rendering' | 'checking' | 'normalizing' | 'done' | 'failed'} Stage
 * @typedef {{ ruleId: string, impact: Impact, weight: number, pass: number, fail: number }} ScoreRule
 * @typedef {{ value: number | null, formulaVersion: 1, standard: string, rulesChecked: number,
 *   elementsChecked: number, failingElements: number, weightedFailures: number, weightedTotal: number,
 *   byImpact: Record<Impact, { fail: number, pass: number }>, rules: ScoreRule[],
 *   manualReviewCount: number, advisoryCount: number, engine: { axeVersion: string } }} Score
 * @typedef {{ id: string, status: 'queued' | 'scanning' | 'completed' | 'failed', stage: Stage,
 *   input: { type: 'html', bytes: number } | { type: 'url', url: string },
 *   violations: Violation[], manualReview: Violation[], advisory: Violation[],
 *   headingOutline: { level: number, text: string, target: string[] }[],
 *   page: { finalUrl: string | null, title: string | null, settled: boolean } | null,
 *   network: { requests: number, blocked: number, blockedSamples: { url: string, reason: string }[] } | null,
 *   timings: { totalMs: number | null }, score: Score | null,
 *   error: { code: string, message: string } | null }} Scan
 * @typedef {{ kind: 'attribute' | 'element' | 'css' | 'document', target: string[],
 *   before: string, after: string, diff: string, copy: string }} Patch
 * @typedef {'proposed' | 'verified' | 'failed' | 'regressed' | 'not-applied' | 'needs-input' | 'manual-review'} RepairStatus
 * @typedef {{ id: string, violationId: string, ruleId: string,
 *   strategy: 'deterministic' | 'llm' | 'template' | 'manual', status: RepairStatus,
 *   confidence: 'high' | 'medium' | 'low', patch: Patch | null, rationale: string, notes: string[],
 *   needsHumanInput: boolean, placeholder: string | null, draft?: string | null, accepted?: boolean,
 *   verification: { outcome: string, detail: string | null } | null }} Repair
 * @typedef {{ verified: number, failed: number, regressed: number, notApplied: number,
 *   needsInput: number, manual: number, scansRun: number }} RepairSummary
 * @typedef {{ provider: string, model: string | null, calls: number, promptTokens: number,
 *   completionTokens: number, totalTokens: number, cacheHits: number, estimatedCostUsd: number | null,
 *   budget: number, budgetExhausted: boolean, deterministicFixes: number, dedupedItems: number,
 *   naiveEstimateTokens: number, tokensSaved: number, tokensPerVerifiedFix: number | null }} TokenSummary
 * @typedef {{ scanId: string, repairs: Repair[], summary: RepairSummary, tokenUsage?: TokenSummary }} CreateRepairsResponse
 * @typedef {{ id: string, scanId: string, status: 'verified' | 'partial' | 'failed',
 *   repairs: { repairId: string, outcome: string, detail: string | null }[],
 *   resolved: Violation[], remaining: Violation[], regressions: Violation[],
 *   manualReview: Violation[], before: Score, after: Score, patchedHtml: string,
 *   scansRun: number, durationMs: number }} VerificationResult
 * @typedef {{ status: 'ok' | 'degraded', checks: { browser: string, store: string, llm: string },
 *   limits: { maxHtmlBytes: number, privateUrlsAllowed: boolean } }} Health
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {{ error?: { code?: string, message?: string, requestId?: string, details?: unknown } } | null} body
   * @param {number | null} retryAfterSec
   */
  constructor(status, body, retryAfterSec = null) {
    super(
      body?.error?.message ?? (status ? `Request failed with ${status}` : 'Cannot reach the API.'),
    );
    this.status = status;
    this.code = body?.error?.code ?? 'NETWORK';
    this.requestId = body?.error?.requestId ?? null;
    this.details = body?.error?.details ?? null;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Seconds until retry, from Retry-After or the draft-8 `RateLimit: ...;t=N` header. */
function retryAfter(res) {
  const ra = Number(res.headers.get('retry-after'));
  if (Number.isFinite(ra) && ra > 0) return ra;
  const t = /;\s*t=(\d+)/.exec(res.headers.get('ratelimit') ?? '');
  return t ? Number(t[1]) : null;
}

async function request(path, { signal, ...init } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'content-type': 'application/json' },
      signal,
      ...init,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, null);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body, res.status === 429 ? retryAfter(res) : null);
  return body;
}

/** @returns {Promise<Health>} */
export const getHealth = () => request('/health');

/** @returns {Promise<{ id: string, status: string, stage: Stage }>} */
export const createScan = (input, signal) =>
  request('/scans', { method: 'POST', body: JSON.stringify({ input }), signal });

/** @returns {Promise<Scan>} */
export const getScan = (id, signal) => request(`/scans/${encodeURIComponent(id)}`, { signal });

/** @returns {Promise<CreateRepairsResponse>} */
export const createRepairs = (id, body = {}, signal) =>
  request(`/scans/${encodeURIComponent(id)}/repairs`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });

/** @returns {Promise<VerificationResult>} */
export const verifyRepairs = (id, body, signal) =>
  request(`/scans/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });

export const patchedHtmlUrl = (id) =>
  `${API_BASE_URL}/scans/${encodeURIComponent(id)}/patched.html`;
