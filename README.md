# AccessFix

Paste HTML, get WCAG 2.2 AA issues in plain language, apply **real source fixes** in an isolated
preview, and see a **verified** before/after score. Fix-first, no overlays, works with the LLM off.

Hackathon problem statement PS 11: "Web Accessibility Auditor + Fix-Suggester".

> **Status: Phase 0 (docs, scaffold, contracts).** Only `GET /health` is live. The other
> endpoints validate input and then return `501 NOT_IMPLEMENTED`. Start with [`docs/`](docs/README.md).

## Quick start

Requirements: Node 20.11+ (see `.nvmrc`), npm 10+.

```bash
npm install                 # installs backend + frontend (npm workspaces)
cp .env.example .env        # optional; every value has a safe default
npm run browsers:install    # Chromium for Playwright (needed from Phase 1)
npm run dev                 # API on :4000, web on :5173
```

Open http://localhost:5173. The header should say **"API online, scanner offline"** (expected in
Phase 0). Check the API directly at http://localhost:4000/health.

## Scripts (run from the repo root)

| Script                            | What it does                                              |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | API (node --watch) and web (Vite) together                |
| `npm test`                        | Vitest in both workspaces                                 |
| `npm run lint`                    | ESLint 9 (flat config, `jsx-a11y` strict on the frontend) |
| `npm run format` / `format:check` | Prettier                                                  |
| `npm run build`                   | Production build of the frontend                          |
| `npm run browsers:install`        | Download Playwright Chromium                              |

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
│   │   ├── repositories/      ScanRepository contract, in-memory adapter (Mongo in Phase 4)
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
