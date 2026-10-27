# 07. LLM cost strategy

The product works with `LLM_PROVIDER=none`. The LLM is a budgeted helper for one job: **drafting
words** (alt text, accessible names, plain-language label text). It never detects violations,
never decides whether a fix is verified, and never writes structural patches.

## When the LLM is called (and when it is not)

| Situation                                         | LLM?                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Rule has a deterministic fixer that succeeded     | No                                                                   |
| Rule is "LLM-assisted" in doc 05 and needs words  | Yes, if enabled, within budget, and the circuit is closed            |
| Explanations and severity text                    | No; static catalog text per rule (written once, reviewed, versioned) |
| Same signature already answered (cache or dedupe) | No                                                                   |
| `useLlm: false` in the request                    | No                                                                   |

## Budgets and size limits

| Limit                       | Default                                                                                                                                            | Config                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Tokens per scan (all calls) | 8,000                                                                                                                                              | `LLM_TOKEN_BUDGET_PER_SCAN` |
| Tokens per client IP / day  | 100,000 (in-memory; resets on process restart)                                                                                                     | `LLM_TOKEN_BUDGET_PER_IP_DAY` |
| Max output tokens per call  | 600                                                                                                                                                | constant                    |
| Max items per batch         | 10                                                                                                                                                 | constant                    |
| Element snippet per item    | ≤ 600 chars, attributes allow-listed (`id`, `class`, `name`, `type`, `href` path, `src` filename, `alt`, `title`, `placeholder`, `aria-*`, `role`) | constant                    |
| Context per item            | ≤ 400 chars of nearest visible text (heading, caption, surrounding sentence)                                                                       | constant                    |
| Images for vision           | Already captured during the scan only. Skip `data:` URLs and bodies over 80 KB. At most 5 images per batch; leftovers fall back to text. Never fetched at repair time, never stored, never logged, never in `/usage`. | `MAX_VISION_BYTES`, `MAX_VISION_PER_BATCH` |

Before every call, the client estimates tokens (≈ chars / 4 + fixed prompt overhead) and the
per-image cost. If the estimate would exceed the remaining budget, the batch is shrunk. Items
that do not fit get the **template** strategy with `rationale: "LLM budget reached"`, and
`budgetExhausted: true` is set on the scan.

Priority inside a scan when the budget is tight: critical before serious; informative images in
the main content before images in the header and footer; then by order on the page.

## Dedupe by rule + pattern signature

```
signature = ruleId + ":" + sha1(normalize(node))[0..12]
normalize(node) = tag + sorted allow-listed attributes, with
  - src/href reduced to filename / path pattern (digits -> #),
  - ids and data-* dropped,
  - inner icon markup reduced to the icon name (svg <use href>, icon class)
```

Ten identical "share" icons across product cards produce **one** LLM item, whose answer is fanned
out to all ten repairs. `dedupedItems` counts the nine that were saved.

## Cache keys

```
cacheKey = sha256(PROMPT_VERSION | model | ruleId | signature | sha1(context) | imageHash?)
```

- In-memory LRU (Phase 3), moving to the repository in Phase 4, with a 30-day TTL.
- Bump `PROMPT_VERSION` whenever a prompt changes, which invalidates old entries naturally.
- Cached items cost 0 tokens and increase `cacheHits`.

## Batching

One request carries up to 10 items with the same tier and rule family. The model must return
JSON shaped like `{ "items": [{ "key": "...", "text": "...", "confidence": "high|medium|low" }] }`.
Responses are validated with Zod. An item that is missing or invalid falls back to the template;
the rest of the batch is kept.

## Model tiering

| Tier       | Config             | Used for                                        |
| ---------- | ------------------ | ----------------------------------------------- |
| Cheap text | `LLM_MODEL_CHEAP`  | Link/button names, label text, `title`, wording |
| Vision     | `LLM_MODEL_VISION` | Informative image alt text from captured scan resources |
| Strong     | `LLM_MODEL_STRONG` | One retry when the cheap result is low-confidence or invalid JSON. Counts against the same 8,000/scan budget. If unset, the retry uses cheap. |
| None       | —                  | Everything else                                 |

If no vision model is configured, alt text uses the cheap model with filename + context and is
marked low confidence.

Behind a reverse proxy, set `TRUST_PROXY` (on by default in production) so `req.ip` is the
client, not the proxy. Otherwise every visitor shares one daily budget.

## Provider rate limits

All calls go through one client-side scheduler inside the LLM service:

1. **Token buckets** for requests per minute (`LLM_RPM`) and tokens per minute (`LLM_TPM`). A
   call waits until both buckets can pay its estimated cost.
2. **Priority queue**: interactive requests (user clicked "Suggest fixes") run before background
   work (pre-warming the cache). The queue length is capped; on overflow, the lowest-priority
   items get the template.
3. **429 / 5xx backoff**: honour `Retry-After` when present; otherwise exponential backoff with
   full jitter, `sleep = random(0, min(20s, 0.5s × 2^attempt))`, at most 3 retries. Each retry
   still counts against the scan's time budget.
4. **Circuit breaker**: 5 consecutive failures within 60 s opens the circuit. While it is open,
   every item gets the template immediately and `/health` shows `llm: circuit-open`. After 30 s,
   one probe call (half-open) decides whether it closes.
5. **Timeouts**: 20 s per call, with an abort signal.

## Fallback to templates

Every LLM-assisted rule has a template that produces a structurally correct patch with a
`TODO:` placeholder and `needsHumanInput: true`. Placeholders are never applied during
verification and never raise the score, so degrading under rate limits stays honest.

## Metrics we show

Per scan (`Scan.tokenUsage`) and per process (`GET /usage`):

| Metric                                     | Definition                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `totalTokens`, `calls`, `estimatedCostUsd` | Actual spend (cost uses `LLM_PRICE_*`; null if unset)                                                                                      |
| `deterministicFixes`                       | Repairs that needed no LLM                                                                                                                 |
| `dedupedItems`, `cacheHits`                | Work avoided                                                                                                                               |
| `naiveEstimateTokens`                      | What one call per violation would cost: for **every** violation, prompt overhead + full outer HTML (up to 2,000 chars) + 200 output tokens |
| `tokensSaved`                              | `naiveEstimateTokens − totalTokens`                                                                                                        |
| `tokensPerVerifiedFix`                     | `totalTokens / verified repairs` (null when 0)                                                                                             |

The results screen shows an **Efficiency** panel: tokens used, tokens saved, cache hits, and one
line for what a naive one-call-per-issue approach would have spent. There is no `/usage` page;
`GET /usage` is the process-level API for the same figures.

## Pricing

Prices change often, so none are hard-coded. Set `LLM_PRICE_INPUT_PER_M` and
`LLM_PRICE_OUTPUT_PER_M` from your provider's current pricing page. The business plan's unit
economics (doc 02) uses the same formula with placeholder values.

## Privacy

Only the allow-listed snippet, short context and (for vision) a captured image already in the
scan cache are sent. Page data is wrapped in `<untrusted>` delimiters. Drafts must be plain words:
HTML tags and URLs are rejected. Full pages, form values, cookies and query strings are never
sent. A self-hosted model (Ollama via the OpenAI-compatible adapter) keeps everything on-premises.

`LLM_PROVIDER=mock` is for CI: canned drafts, token counts from prompt size, `tokensSaved > 0`
versus the naive estimate. `LLM_PROVIDER=none` or an empty `LLM_API_KEY` produces the same
patches as `useLlm: false`.
