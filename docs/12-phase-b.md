# 12. Phase B — crawl, accounts, and quotas

Phase B scans more than one page, with accounts, without giving the scanner a way to wander off
the host or keep a password. The product still works with the LLM off, and with no Redis and no
Mongo. `npm test` uses the in-process queue and the memory store.

## What a crawl is

`POST /scans` with `options.crawl: true` needs a signed-in user and a URL. It is **one scan**.
Pages run **one after another** on the host the seed URL lands on after redirects (`example.com`
to `www.example.com` pins `www.example.com`, and the log says so). A later redirect off that host
is dropped. Order is breadth-first, so a cap keeps the shallowest pages.

While `QUOTAS_ENABLED` is false, everyone gets `CRAWL_MAX_PAGES` (10) and `CRAWL_MAX_DEPTH` (2).
The Free 5 / Pro 10 split applies only when quotas are on. One request at a time to the pinned
host, 500 ms apart, or the site's `Crawl-delay` if that is larger, and never more than 5 seconds.

The 3-minute clock (`CRAWL_BUDGET_MS`) starts when the job **starts running**, not when it is
queued. When it runs out, the page in progress is aborted with its `AbortSignal` and stored as
`skipped (time limit)`. A half-scanned page is never a result. The scan completes as `partial`.
Finished pages and the site score are kept. Apply works on those pages and is refused with
`409 SCAN_NOT_READY` while the crawl is still running.

Same-pattern issues are sent to the model once. The patch is still verified on every page it is
written to. A page that fails verification is not counted as fixed. Contrast, heading order,
labels, and duplicate ids are computed per page and cost no tokens.

## Accounts

Sign-up creates one project named Personal. Passwords are hashed with Node's `scrypt`. There is
**no password reset** and no email. Login returns "Invalid email or password" for a wrong
password and for an unknown email, and it always runs a hash so the timing does not say which
emails exist. Ten failures in an hour do not lock the account. The next attempt waits 1s, then
2s, 4s, up to 15s. More than 100 attempts from one IP in an hour is `429` with `Retry-After`.
Those counters are stored in Mongo when `STORE=mongo`, so a restart does not clear them.

The session cookie is `accessfix.sid`, HttpOnly. Default `SameSite=Lax`. In development the UI
is same-origin with the API via the Vite `/api` proxy, so Lax works. Production should proxy
`/api` the same way (or use one site). `COOKIE_SAMESITE=none` is the fallback and forces
`Secure`. A state-changing request that already has the cookie must send `x-accessfix-request: 1`
and an `Origin` in `CORS_ORIGINS`. Requests with no cookie are unchanged.

A scan started while signed in is private. Every scan route (report, screenshot, events, source,
repairs, verify, cancel, zip) returns **404** with the same body as a missing scan. A share link
is `GET /shares/:token` (the token is in the path, not the query). It is read-only, shows no
email, is `Cache-Control: no-store`, and can be revoked. Authenticated scans cannot be shared.
A signed-out paste is still a capability link. Old scans are not claimed.

## Login state

`auth.storageState` or `auth.cookies` is encrypted with AES-256-GCM under `AUTH_STATE_KEYS`
(`id:` plus 32 bytes of base64; the first key encrypts, later keys still decrypt). The queue
job is `{ scanId }` only. The secret is deleted when the job settles, including cancel and the
last retry, and a startup sweep drops anything older than an hour. If the key is unset, only
authenticated scans are refused. `/health` then says `authenticatedScanning: "disabled: no key"`.
The secret is attached only to the pinned host. Pages are kept 15 minutes from completion.
Apply after that is refused in plain language.

## Quotas

`QUOTAS_ENABLED` defaults to **false**. That turns off daily scan, page, and token caps,
including the signed-out scan cap. Meters still count, so `/usage` stays honest. `/health`
reports `quotas: "off"`. The business page must not present Free/Pro numbers as enforced while
that flag is off.

These stay on either way, because they protect the server: the burst limit (`SCAN_RATE_LIMIT_RPM`,
default 30), the Chromium cap, per-scan and per-crawl timeouts, the 2 MB page cap, the 256 MB
HTML cache (oldest out first), SSRF on the resolved address and every redirect, `robots.txt`,
and the 20 MB zip refusal.

`LLM_TOKEN_BUDGET_PER_SCAN` and `LLM_TOKEN_DAILY_CEILING` default to **0**, which means no
limit. The ceiling is per UTC day for the whole process. With `STORE=mongo` it survives a
restart. When it is hit, drafts fall back to templates and the repair note says so, and
`/health` shows `tokenCeiling: "reached"`. Startup fails if the ceiling is above 0 and smaller
than the per-scan budget. Startup also fails if `REDIS_URL` is set without `STORE=mongo`, or if
Pro's daily token number is not greater than Free's.

Pro is `PRO_EMAILS` (checked at login) or `npm run plan:pro -- user@example.com`. No admin UI.

## Jobs

`REDIS_URL` with `STORE=mongo` uses BullMQ. The worker stays **inside the API process**. Redis
is only the queue. Cancel aborts the browser context. Without Redis, the in-process queue is
used, including in tests. Retries are only for an internal crash, once.

## Data already stored

Scans saved before Phase B have no `ownerId`. They stay capability links. Nothing migrates them
to an account. New fields (`pages`, `keyboard`, `partial`, `authUsed`) default to empty, so old
documents still parse.

## Keyboard and SPA wait

After axe, the scanner presses Tab up to `KEYBOARD_MAX_STOPS` (50). The result is
`scan.keyboard`: checks with a confidence. They are not axe violations and do not change the
score. A DOM-quiet window (500 ms) and an optional `waitFor` selector run before axe. If the
selector never appears, the scan still succeeds and `renderWarning` says the page may not be
fully rendered.
