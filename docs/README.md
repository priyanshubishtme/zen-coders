# AccessFix docs

Start here. Read in order; each doc is short.

| #   | Doc                                                 | Answers                                                     |
| --- | --------------------------------------------------- | ----------------------------------------------------------- |
| 01  | [Product brief](01-product-brief.md)                | What we build, for whom, why it is different, sourced facts |
| 02  | [Business plan](02-business-plan.md)                | Who pays, how much, what a scan costs us, risks             |
| 03  | [Architecture](03-architecture.md)                  | Modules, data flow, error model, extension points           |
| 04  | [API contract](04-api-contract.md)                  | Endpoints and the five core objects                         |
| 05  | [Repair catalog](05-repair-catalog.md)              | Rule -> fix strategy -> verification -> confidence          |
| 06  | [Scoring spec](06-scoring-spec.md)                  | The exact score formula and what it does not mean           |
| 07  | [LLM cost strategy](07-llm-cost-strategy.md)        | Budgets, dedupe, caching, rate limits, fallbacks            |
| 08  | [UX spec](08-ux-spec.md)                            | Journey, screens, states, design tokens                     |
| 09  | [Roadmap and future pathways](09-roadmap-future.md) | How each hard problem plugs in later                        |

## Decisions locked in Phase 0

| Topic        | Decision                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Standard     | WCAG 2.2 Level A + AA. AAA off by default (opt-in). axe `best-practice` results shown as **advisory**, outside the score.     |
| Detection    | axe-core plus our own deterministic checks only. The LLM never reports a violation.                                           |
| Repair order | Deterministic rule fixer, then LLM (judgment only, within budget), then template, then "needs manual review".                 |
| Verification | Apply to a copy, re-run axe; "verified" only if the violation is gone and nothing regressed.                                  |
| Score        | `100 * (1 - Σ w·fail / Σ w·(pass+fail))`, fixed per-rule weights 10/7/3/1, needs-review excluded, "N/A" when nothing applies. |
| LLM          | One OpenAI-compatible adapter behind a provider interface. Default `LLM_PROVIDER=none`. Cheap text model + vision model.      |
| Store        | Repository interface; in-memory adapter first, MongoDB Atlas in Phase 4. App runs without Mongo.                              |
| Repo         | npm workspaces, ES modules, Vitest everywhere, ESLint 9 + Prettier + jsx-a11y.                                                |
| Pricing      | Free / Pro $19 / Team $79 / Enterprise custom. Hypotheses, not validated.                                                     |

## Phases

| Phase | Scope                                                                                                                                                                                   | Exit criterion                                                                              | Status |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| 0     | Docs, scaffold, contracts                                                                                                                                                               | A new teammate can say what to build, why, and what is out of scope                         | Done   |
| 1     | Scan pipeline: pasted HTML **and URL** (SSRF-hardened), browser pool, axe + our checks, normalizer, plain-language templates, repository (memory + Mongo stub), scan UI with all states | The broken sample returns the expected violations in under 5 s; hostile input never crashes | Done   |
| 2     | Repairs (deterministic first), verification by re-scan, score, before/after view                                                                                                        | Verified fixes raise the score with zero regressions, LLM off                               | Next   |
| 3     | LLM provider, token accounting, cache, batching, rate limiting                                                                                                                          | Tokens per verified fix shown; app still works with LLM off                                 |        |
| 4     | MongoDB adapter, scan history, Recharts trends                                                                                                                                          | Same contract tests pass on both adapters                                                   |        |
| 5     | Polish, shareable report, `/business` page, demo hardening                                                                                                                              | We pass our own audit with score 100 and zero regressions                                   |        |

## Deliberately out of scope (until the core loop works)

- Auth, accounts, teams, billing.
- Multi-agent systems.
- Multi-page crawling, SPA route discovery, auth-gated pages.
- Mapping fixes back to framework source files (JSX, templates). We patch the HTML/CSS we were given.
- Full ARIA widget semantics (menus, grids, comboboxes) and keyboard-trap detection.
- Runtime overlays or injected widgets. Never, by principle.

Each has a documented pathway in [09-roadmap-future.md](09-roadmap-future.md).
