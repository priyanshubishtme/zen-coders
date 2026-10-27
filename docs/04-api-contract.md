# 04. API contract

Base URL: `http://localhost:4000` (dev). JSON in and out. The source of truth is
`backend/src/schemas/*.js`; this doc mirrors it. When they disagree, the code wins and this doc
gets fixed in the same PR.

Every error uses the envelope in [03-architecture.md#error-model](03-architecture.md#error-model).

## Endpoints

| Method | Path                 | Purpose                                   | Success                     | Phase                 |
| ------ | -------------------- | ----------------------------------------- | --------------------------- | --------------------- |
| `GET`  | `/health`            | Liveness + dependency status              | `200 HealthResponse`        | 0 (live)              |
| `POST` | `/scans`             | Scan pasted HTML (or a URL, Phase 2)      | `201 Scan`                  | 1                     |
| `GET`  | `/scans/:id`         | Fetch a scan                              | `200 Scan`                  | 1                     |
| `POST` | `/scans/:id/repairs` | Propose one Repair per selected violation | `200 CreateRepairsResponse` | 1                     |
| `POST` | `/scans/:id/verify`  | Apply repairs to a copy, re-scan, compare | `200 VerificationResult`    | 1                     |
| `GET`  | `/scans/:id/report`  | Report as `json`, `md` or `html`          | `200`                       | 1 (json), 5 (md/html) |
| `GET`  | `/usage`             | Token and scan usage since process start  | `200 UsageResponse`         | 1 (zeros), 3 (real)   |

Until a route is implemented it returns `501 NOT_IMPLEMENTED`. Validation still runs first, so
clients can integrate against the real error behaviour today.

Rate limits: `POST` routes share a per-IP limit (`RATE_LIMIT_RPM`, default 30/min) and return
standard `RateLimit` headers.

## Requests

```js
// POST /scans
CreateScanBody = z.object({
  input: z.discriminatedUnion('type', [
    z.object({ type: z.literal('html'), html: z.string().min(1) }), // <= MAX_HTML_BYTES, else 413
    z.object({ type: z.literal('url'), url: z.url({ protocol: /^https?$/ }) }), // 422 until Phase 2
  ]),
  options: z
    .object({
      includeAAA: z.boolean().default(false),
      includeBestPractice: z.boolean().default(true), // shown as advisory, never scored
    })
    .default({ includeAAA: false, includeBestPractice: true }),
});

// POST /scans/:id/repairs
CreateRepairsBody = z
  .object({
    violationIds: z.array(Id).max(500).optional(), // omit = all open violations
    useLlm: z.boolean().default(true), // false = deterministic + template only
  })
  .default({ useLlm: true });

// POST /scans/:id/verify
VerifyBody = z.object({
  repairIds: z.array(Id).min(1).max(500),
  // Replace a patch's "after" text, e.g. reviewed alt text. Re-diffed server-side.
  edits: z
    .array(z.object({ repairId: Id, after: z.string().min(1).max(5000) }))
    .max(500)
    .optional(),
});
// A patch whose final text still contains PLACEHOLDER_MARKER ("TODO:") is not applied:
// outcome "not-applied", detail "Fill in the placeholder first". Placeholders never count as fixes.

// GET /scans/:id/report
ReportQuery = z.object({ format: z.enum(['json', 'md', 'html']).default('json') });

// :id everywhere
ScanIdParams = z.object({ id: Id }); // Id = z.string().min(1).max(64)
```

## Core objects

### Violation

One failing (or needs-review) **element** for one **rule**.

```js
Violation = z.object({
  id: Id,
  ruleId: z.string(), // axe rule id, e.g. "image-alt"
  source: z.enum(['axe', 'accessfix']),
  outcome: z.enum(['violation', 'needs-review']),
  category: z.enum(['wcag', 'best-practice']), // best-practice => advisory[]
  impact: z.enum(['critical', 'serious', 'moderate', 'minor']),
  wcag: z.object({
    criteria: z.array(z.string().regex(/^\d\.\d+\.\d+$/)), // e.g. ["1.4.3"]
    level: z.enum(['A', 'AA', 'AAA']).nullable(),
  }),
  title: z.string(), // plain language
  explanation: z.string(), // who is affected and why
  helpUrl: z.url().nullable(),
  node: z.object({
    target: z.array(z.string()).min(1), // axe selector path
    html: z.string().max(2000), // snippet, truncated
    failureSummary: z.string().nullable(),
  }),
  signature: z.string(), // ruleId + normalized pattern hash
  status: z.enum(['open', 'fix-proposed', 'fixed-verified', 'fix-failed', 'manual-review']),
});
```

### Repair

```js
Patch = z.object({
  kind: z.enum(['attribute', 'element', 'css', 'document']),
  target: z.array(z.string()).min(1),
  before: z.string(),
  after: z.string(),
  diff: z.string(), // unified diff, copy-pasteable
});

Repair = z.object({
  id: Id,
  violationId: Id,
  ruleId: z.string(),
  strategy: z.enum(['deterministic', 'llm', 'template', 'manual']),
  status: z.enum(['proposed', 'verified', 'failed', 'manual-review']),
  confidence: z.enum(['high', 'medium', 'low']),
  patch: Patch.nullable(), // null only when strategy = manual
  rationale: z.string(),
  needsHumanInput: z.boolean(), // placeholder or AI draft to review
  tokenUsage: TokenUsage.nullable(), // null for deterministic/template/manual
  createdAt: z.iso.datetime(),
});
```

### VerificationResult

```js
VerificationResult = z.object({
  id: Id,
  scanId: Id,
  status: z.enum(['verified', 'partial', 'failed']), // all / some / none verified
  repairs: z.array(
    z.object({
      repairId: Id,
      outcome: z.enum(['resolved', 'still-failing', 'regressed', 'not-applied']),
      detail: z.string().nullable(),
    }),
  ),
  regressions: z.array(Violation), // new violations caused by the patches
  before: Score,
  after: Score,
  patchedHtml: z.string(),
  durationMs: z.number().int().nonnegative(),
  verifiedAt: z.iso.datetime(),
});
```

### Score

```js
Score = z.object({
  value: z.number().int().min(0).max(100).nullable(),  // null => "N/A"
  formulaVersion: z.literal(1),
  standard: z.string(),                                // "WCAG 2.2 AA"
  rulesChecked: count, elementsChecked: count, failingElements: count,
  weightedFailures: count, weightedTotal: count,
  byImpact: { critical: {fail, pass}, serious: {...}, moderate: {...}, minor: {...} },
  manualReviewCount: count,                            // not in the value
  advisoryCount: count,                                // not in the value
  engine: z.object({ axeVersion: z.string() }),
});
```

### TokenUsage and ScanTokenSummary

```js
TokenUsage = z.object({
  provider: z.enum(['none', 'openai-compatible', 'mock']),
  model: z.string().nullable(),
  calls: count,
  promptTokens: count,
  completionTokens: count,
  totalTokens: count,
  cacheHits: count,
  estimatedCostUsd: z.number().nonnegative().nullable(), // null if no price configured
});

ScanTokenSummary = TokenUsage.extend({
  budget: count,
  budgetExhausted: z.boolean(),
  deterministicFixes: count,
  dedupedItems: count,
  naiveEstimateTokens: count, // one call per violation, full snippet
  tokensSaved: count, // naive - actual
  tokensPerVerifiedFix: z.number().nonnegative().nullable(),
});
```

### Scan

```js
Scan = z.object({
  id: Id,
  status: z.enum(['queued', 'scanning', 'completed', 'failed']),
  input: { type: 'html', bytes } | { type: 'url', url }, // raw HTML is not echoed back
  options: ScanOptions,
  violations: z.array(Violation), // scored
  manualReview: z.array(Violation), // axe "incomplete"
  advisory: z.array(Violation), // best-practice
  score: Score.nullable(),
  tokenUsage: ScanTokenSummary,
  error: z.object({ code, message }).nullable(),
  createdAt,
  completedAt,
  durationMs,
});
```

## Other responses

```js
HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']), // degraded = API up, scanner down
  version: z.string(),
  uptimeSec: z.number(),
  checks: z.object({
    browser: z.enum(['up', 'down', 'unknown']),
    store: z.enum(['memory', 'mongo']),
    llm: z.enum(['off', 'on', 'circuit-open']),
  }),
});

CreateRepairsResponse = z.object({
  scanId: Id,
  repairs: z.array(Repair),
  tokenUsage: ScanTokenSummary,
});

UsageResponse = z.object({
  since: z.iso.datetime(),
  scans: count,
  verifiedFixes: count,
  tokens: ScanTokenSummary,
  rateLimiter: z.object({ queued: count, rpmRemaining: count, tpmRemaining: count }),
});
```

## Example: scan

```http
POST /scans
{ "input": { "type": "html", "html": "<html><body><img src=\"a.jpg\"></body></html>" } }
```

```json
{
  "id": "s_8f3k2",
  "status": "completed",
  "input": { "type": "html", "bytes": 46 },
  "violations": [
    {
      "id": "v_1",
      "ruleId": "image-alt",
      "source": "axe",
      "outcome": "violation",
      "category": "wcag",
      "impact": "critical",
      "wcag": { "criteria": ["1.1.1"], "level": "A" },
      "title": "Image has no text alternative",
      "explanation": "Screen reader users hear only the file name or nothing at all.",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/image-alt",
      "node": { "target": ["img"], "html": "<img src=\"a.jpg\">", "failureSummary": "..." },
      "signature": "image-alt:7c1e",
      "status": "open"
    },
    "... html-has-lang, document-title ..."
  ],
  "manualReview": [],
  "advisory": ["... landmark-one-main, region ..."],
  "score": { "value": 38, "standard": "WCAG 2.2 AA", "...": "..." }
}
```

## Versioning

Additive changes (new optional fields, new enum values on outputs) are allowed without a version
bump. Clients must ignore unknown fields. Breaking changes require a `/v2` prefix.
`Score.formulaVersion` changes whenever the formula changes, so stored scores remain comparable.
