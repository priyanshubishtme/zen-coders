# 04. API contract

Base URL: `http://localhost:4000` (dev). JSON in and out. The source of truth is
`backend/src/schemas/*.js`; this doc mirrors it. When they disagree, the code wins and this doc
gets fixed in the same PR.

Every error uses the envelope in [03-architecture.md#error-model](03-architecture.md#error-model).

## Endpoints

| Method | Path                 | Purpose                                        | Success                     | Status                            |
| ------ | -------------------- | ---------------------------------------------- | --------------------------- | --------------------------------- |
| `GET`  | `/health`            | Liveness, dependency status, limits            | `200 HealthResponse`        | Live                              |
| `POST` | `/scans`             | Validate input and start a scan (HTML or URL)  | `202 ScanAccepted`          | Live (Phase 1)                    |
| `GET`  | `/scans/:id`         | Poll a scan: `stage`, then results             | `200 Scan`                  | Live (Phase 1)                    |
| `GET`  | `/usage`             | Scan count and token usage since process start | `200 UsageResponse`         | Live (process totals; no UI page) |
| `POST` | `/scans/:id/repairs` | Propose one Repair per selected violation      | `200 CreateRepairsResponse` | Live (Phase 2)                    |
| `POST` | `/scans/:id/verify`  | Apply repairs to a copy, re-scan, compare      | `200 VerificationResult`    | Live (Phase 2)                    |
| `GET`  | `/scans/:id/patched.html` | Latest patched source (attachment)        | `200 text/html`             | Live (Phase 2)                    |
| `GET`  | `/scans`             | Capability list: `?ids=` (max 50)              | `200 { scans }`             | Live (Phase 4)                    |
| `GET`  | `/scans/:id/report`  | Report as `json`, `md` or `html`               | `200`                       | Live (Phase 4). HTML is escaped, script-free, CSP + attachment. |

Until a route is implemented it returns `501 NOT_IMPLEMENTED`. Validation still runs first, so
clients can integrate against the real error behaviour today.

### Scan lifecycle (polling)

1. `POST /scans` validates the body (Zod), the HTML size and the URL safety check (scheme, DNS,
   private ranges) **before** answering. Failures come back immediately as 4xx.
2. On success: `202` with `{ id, status: "queued", stage: "queued" }` and a `Location` header.
3. Poll `GET /scans/:id` (the UI uses 500 ms). `stage` moves through
   `queued -> loading -> rendering -> checking -> normalizing -> done`, or ends in `failed`.
4. When `status` is `completed` or `failed`, stop polling. A failed scan carries a typed
   `error: { code, message }` (for example `SCAN_TIMEOUT`, `FETCH_FAILED`, `UNSUPPORTED_INPUT`).

Rate limits: every route shares a per-IP limit (`RATE_LIMIT_RPM`, default 300/min, enough for
polling). `POST` routes also have a stricter per-IP limit (`SCAN_RATE_LIMIT_RPM`, default 10/min).
Both return standard draft-8 `RateLimit` headers; the UI reads `t=` for its countdown.

## Requests

```js
// POST /scans
CreateScanBody = z.object({
  input: z.discriminatedUnion('type', [
    // <= MAX_HTML_BYTES (413), not binary (422 UNSUPPORTED_INPUT), NUL bytes stripped
    z.object({ type: z.literal('html'), html: z.string().min(1) }),
    // http(s) only, no credentials, must not resolve to a private/reserved address (422 URL_BLOCKED)
    z.object({ type: z.literal('url'), url: z.url({ protocol: /^https?$/ }).max(2048) }),
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
  // Replace a template repair's PLACEHOLDER_MARKER text (e.g. reviewed alt text).
  edits: z
    .array(z.object({ repairId: Id, text: z.string().trim().min(1).max(500) }))
    .max(500)
    .optional(),
  // LLM drafts are applied only when listed here. The server rejects unaccepted ones.
  acceptedRepairIds: z.array(Id).max(500).optional(),
  // Restore these LLM drafts to their TODO: templates.
  rejectedRepairIds: z.array(Id).max(500).optional(),
});
// A patch whose final text still contains PLACEHOLDER_MARKER ("TODO:") is not applied:
// outcome "not-applied", detail "Fill in the placeholder first". Placeholders never count as fixes.
// An LLM repair that is not in acceptedRepairIds is not-applied: "Accept the AI draft first".

// GET /scans?ids=s_…,s_…  (1–50 capability ids; no global list)
ListScansQuery = z.object({
  ids: z.string().min(1).max(4000).transform((raw) => raw.split(',').map((s) => s.trim()).filter(Boolean)).pipe(z.array(Id).min(1).max(50)),
});

// GET /scans/:id/report  — HTML is script-free, escaped, CSP + Content-Disposition
ReportQuery = z.object({ format: z.enum(['json', 'md', 'html']).default('json') });

// :id everywhere
ScanIdParams = z.object({ id: Id }); // Id = z.string().min(1).max(64)
// Scan ids are `s_` + 21+ URL-safe nanoid characters. They are capability URLs:
// anyone who has the id can read the scan and report. Links expire after SCAN_TTL_DAYS.
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
    // One chip per criterion, linking to the W3C "Understanding" page.
    refs: z.array(
      z.object({ sc: z.string(), name: z.string(), level: WcagLevel.nullable(), url: z.url() }),
    ),
  }),
  title: z.string(), // plain language, from our template library (no LLM)
  explanation: z.string(), // why it matters
  whoItAffects: z.string(), // e.g. "Blind and low-vision people using screen readers"
  helpUrl: z.url().nullable(), // axe rule docs; null for our own checks
  node: z.object({
    target: z.array(z.string()).min(1), // one selector per frame; shadow DOM hops joined with " >>> "
    html: z.string().max(2000), // snippet, truncated
    failureSummary: z.string().nullable(),
  }),
  signature: z.string(), // ruleId + normalized pattern hash
  status: z.enum(['open', 'fix-proposed', 'fixed-verified', 'fix-failed', 'manual-review']),
});
```

- `id` is `v_` + a hash of (input hash, rule, outcome, target), so it is stable for the same input.
- `signature` is `ruleId:` + a hash of the element's pattern: tag, identity attributes (`type`,
  `role`, `name`, `alt`, `title`, `placeholder`, `aria-*`, `href`/`src` reduced to the file
  name), and short normalized text. Ids, classes, `data-*` and digits are ignored, so ten
  identical icon buttons share one signature (doc 07 dedupe).
- Our own checks use `source: "accessfix"` and rule ids prefixed `afx-` (`afx-heading-skip`,
  `afx-heading-multiple-h1`, `afx-heading-missing-h1`, `afx-heading-empty`,
  `afx-link-ambiguous`). They are always advisory. When axe flags the same element for the
  overlapping rule (`heading-order`, `page-has-heading-one`, `empty-heading`), only the axe
  result is kept.

### Repair

```js
Patch = z.object({
  kind: z.enum(['attribute', 'element', 'css', 'document']),
  target: z.array(z.string()).min(1),
  before: z.string(),
  after: z.string(),
  diff: z.string(), // unified diff, copy-pasteable
  copy: z.string(), // one-line explanation + diff, for "Copy fix"
});

Repair = z.object({
  id: Id,
  violationId: Id,
  ruleId: z.string(),
  strategy: z.enum(['deterministic', 'llm', 'template', 'manual']),
  status: z.enum([
    'proposed',
    'verified',
    'failed',
    'regressed',
    'not-applied',
    'needs-input',
    'manual-review',
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
  patch: Patch.nullable(), // null only when strategy = manual
  rationale: z.string(),
  notes: z.array(z.string()),
  needsHumanInput: z.boolean(), // placeholder or AI draft to review
  placeholder: z.string().nullable(),
  draft: z.string().nullable().optional(), // LLM (or user-edited) words; null for unfilled templates
  accepted: z.boolean().optional().default(false), // LLM drafts stay false until the user accepts
  tokenUsage: TokenUsage.nullable(), // null for deterministic/template/manual
  verification: z
    .object({
      outcome: z.enum(['resolved', 'still-failing', 'regressed', 'not-applied']),
      detail: z.string().nullable(),
    })
    .nullable(),
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
  resolved: z.array(Violation),
  remaining: z.array(Violation),
  regressions: z.array(Violation), // new violations caused by the patches; always shown
  manualReview: z.array(Violation),
  before: Score,
  after: Score,
  patchedHtml: z.string(),
  scansRun: z.number().int().nonnegative(),
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
  rules: z.array(z.object({ ruleId, impact, weight, pass, fail })),
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
  id: Id, // "s_" + 12 random chars
  status: z.enum(['queued', 'scanning', 'completed', 'failed']),
  stage: z.enum(['queued', 'loading', 'rendering', 'checking', 'normalizing', 'done', 'failed']),
  input: { type: 'html', bytes } | { type: 'url', url }, // raw HTML is never stored or echoed
  inputHash: z.string().length(64), // sha256("html\n" + html) or sha256("url\n" + url)
  options: ScanOptions,
  violations: z.array(Violation), // WCAG A/AA failures
  manualReview: z.array(Violation), // axe "incomplete": a person must decide
  advisory: z.array(Violation), // best-practice + our own checks
  headingOutline: z.array(z.object({ level, text, target })),
  page: z.object({ finalUrl, title, settled }).nullable(), // settled=false: network never went quiet
  network: z
    .object({
      requests: count, // unique URLs the page asked for
      blocked: count, // unique URLs not loaded: blocked for safety, over limits, or failed
      blockedSamples: z.array(z.object({ url, reason })), // first 10
    })
    .nullable(),
  engine: z.object({ axeVersion }).nullable(),
  timings: { queueMs, loadMs, renderMs, axeMs, checksMs, normalizeMs, totalMs }, // all nullable ms
  score: Score.nullable(), // null in Phase 1
  tokenUsage: ScanTokenSummary,
  error: z.object({ code, message }).nullable(),
  createdAt,
  completedAt,
});

ScanAccepted = Scan.pick({ id, status, stage }); // 202 body of POST /scans
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
  limits: z.object({
    maxHtmlBytes: z.number(), // the UI validates against this before sending
    privateUrlsAllowed: z.boolean(), // dev/test only; the UI shows a warning badge
  }),
});

CreateRepairsResponse = z.object({
  scanId: Id,
  repairs: z.array(Repair),
  summary: z.object({
    verified: count,
    failed: count,
    regressed: count,
    notApplied: count,
    needsInput: count,
    manual: count,
    scansRun: count,
  }),
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

## Example: scan the broken sample

```http
POST /scans
{ "input": { "type": "html", "html": "<!doctype html><html>…" } }

202 Accepted
Location: /scans/s_Xk2…
{ "id": "s_Xk2…", "status": "queued", "stage": "queued" }
```

Polling `GET /scans/s_Xk2…` until `status` is `completed` (about 1.5 s for
`samples/broken-sample.html`). Real output, trimmed:

```json
{
  "status": "completed",
  "stage": "done",
  "violations": [
    {
      "id": "v_b8872a833449",
      "ruleId": "button-name",
      "source": "axe",
      "outcome": "violation",
      "category": "wcag",
      "impact": "critical",
      "wcag": {
        "criteria": ["4.1.2"],
        "level": "A",
        "refs": [
          {
            "sc": "4.1.2",
            "name": "Name, Role, Value",
            "level": "A",
            "url": "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
          }
        ]
      },
      "title": "Button has no name",
      "explanation": "This button has no text a screen reader can announce, so people hear only \"button\" and cannot tell what it does.",
      "whoItAffects": "Screen reader and voice-control users",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/button-name",
      "node": {
        "target": ["button[type=\"button\"]"],
        "html": "<button type=\"button\">…</button>",
        "failureSummary": "Fix any of the following: …"
      },
      "signature": "button-name:5b9693ad1e1e",
      "status": "open"
    },
    "… color-contrast, html-has-lang, image-alt, label, link-name …"
  ],
  "manualReview": ["… color-contrast on text over a gradient …"],
  "advisory": ["… heading-order, afx-heading-multiple-h1, afx-link-ambiguous …"],
  "headingOutline": [
    { "level": 1, "text": "Weekly specials", "target": ["h1"] },
    { "level": 3, "text": "Sourdough", "target": ["h3"] },
    { "level": 1, "text": "Newsletter", "target": ["main > h1:nth-of-type(2)"] }
  ],
  "network": { "requests": 0, "blocked": 0, "blockedSamples": [] },
  "timings": { "loadMs": 13, "renderMs": 498, "axeMs": 721, "checksMs": 6, "totalMs": 1407 },
  "score": { "value": 62, "formulaVersion": 1, "standard": "WCAG 2.2 AA" }
}
```

## Versioning

Additive changes (new optional fields, new enum values on outputs) are allowed without a version
bump. Clients must ignore unknown fields. Breaking changes require a `/v2` prefix.
`Score.formulaVersion` changes whenever the formula changes, so stored scores remain comparable.
