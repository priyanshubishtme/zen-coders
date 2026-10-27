# AccessFix

Paste HTML, get WCAG 2.2 AA issues in plain language, apply **real source fixes** in an isolated
preview, and see a **verified** before/after score. Fix-first, no overlays, works with the LLM off.

Hackathon problem statement PS 11: "Web Accessibility Auditor + Fix-Suggester".

> **Status: Phase 4.** Paste HTML or a URL, get verified source fixes, optional AI drafts, a
> shareable report, scan history, and a `/business` page. Memory store by default; Mongo when you
> set `STORE=mongo`. The full map of decisions, architecture, and future scope is
> [`project.md`](project.md). Short specs live in [`docs/`](docs/README.md).

## Quick start

Requirements: Node 20.11+ (see `.nvmrc`), npm 10+.

```bash
npm install                 # installs backend + frontend (npm workspaces)
cp .env.example .env        # optional; every value has a safe default
npm run browsers:install    # Chromium for Playwright (~150 MB, once)
npm run dev                 # API on :4000, web on :5173
```

Open http://localhost:5173. The header should say **"API online"**. Click **Try the broken
sample** to scan `samples/broken-sample.html` (about 1.5 s). Then **Suggest fixes** and
**Apply verified fixes** — the score should rise, with placeholders (like image alt text)
left for you to fill in.

To scan a local site (for example the AccessFix UI itself), start the API with
`ALLOW_PRIVATE_URLS=true` in `.env`. That is dev-only: the server refuses it in production and
the UI shows a warning badge while it is on.

## Scripts (run from the repo root)

| Script                            | What it does                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                     | API (node --watch) and web (Vite) together                                   |
| `npm test`                        | Vitest in both workspaces (browser tests skip loudly if Chromium is missing) |
| `npm run test:browser -w backend` | Only the real-Chromium suites                                                |
| `npm run test:unit -w backend`    | Only the fast backend unit tests                                             |
| `npm run lint`                    | ESLint 9 (flat config, `jsx-a11y` strict on the frontend)                    |
| `npm run format` / `format:check` | Prettier                                                                     |
| `npm run build`                   | Production build of the frontend                                             |
| `npm run browsers:install`        | Download Playwright Chromium                                                 |

## Layout

```
.
├── docs/                      product, business, architecture, contracts (read first)
├── backend/
│   ├── src/
│   │   ├── app.js             createApp(config, overrides): DI root, middleware, routes
│   │   ├── server.js          process entry
│   │   ├── config/env.js      Zod-validated config, safe defaults
│   │   ├── routes/            route table mirroring docs/04-api-contract.md
│   │   ├── controllers/       thin HTTP adapters -> orchestrator
│   │   ├── middleware/        validate (Zod), rate limit, timeout, error envelope
│   │   ├── schemas/           Zod contracts: Violation, Repair, VerificationResult, Score, TokenUsage, Scan
│   │   ├── services/
│   │   │   ├── orchestrator/  sequences scan -> repair -> verify
│   │   │   ├── scanner/       Playwright + axe-core (+ checks/ for our own rules)
│   │   │   ├── repair/        repair engine (+ rules/ one fixer per axe rule)
│   │   │   ├── verifier/      apply to copy, re-scan, diff
│   │   │   ├── scorer/        pure score function
│   │   │   └── llm/           provider interface (none | openai-compatible | mock)
│   │   ├── repositories/      ScanRepository contract, memory + Mongo adapters
│   │   └── utils/             errors, logger
│   └── tests/                 Vitest + Supertest (fixtures/ for rule HTML)
└── frontend/
    ├── components.json        shadcn/ui config (JavaScript)
    └── src/
        ├── App.jsx            shell: skip link, header, main
        ├── components/        ApiStatus (+ shadcn ui/ as added)
        ├── lib/               api client, contrast math, cn()
        └── styles/tokens.js   design tokens (source of truth, contrast-tested)
```

## Principles (short version)

1. Every issue ends in a patch or an honest "needs manual review".
2. We change source markup and CSS; we never inject runtime widgets.
3. Deterministic fixes first; the LLM only drafts words.
4. Token cost is tracked, budgeted and shown.
5. Detection comes only from axe-core and our own deterministic checks.
6. A fix is "verified" only after a re-scan shows the violation gone and nothing regressed.
7. The product works with the LLM turned off.

The score covers automated checks only. It is not a WCAG conformance claim. See
[docs/06-scoring-spec.md](docs/06-scoring-spec.md).

Optional Mongo (not required for `npm run dev` or `npm test`):

```bash
docker compose up -d mongo
# then STORE=mongo and MONGODB_URI=mongodb://127.0.0.1:27017/accessfix in .env
```

See [docs/10-deploy.md](docs/10-deploy.md) and [docs/11-demo-script.md](docs/11-demo-script.md).
