# 09. Roadmap and future pathways

No implementation here. Each section says **where it plugs in**, **what changes in the
contract**, **the main risk**, and **when to start**. The rule stays the same: nothing here starts
until the core loop (Phase 1) works end to end.

## URL input (Phase 2), the prerequisite for most of the below

- **Plug-in:** a `safeFetch` utility used by the scanner's URL adapter. It resolves DNS first and
  blocks private, loopback, link-local and metadata ranges (IPv4 and IPv6), re-checks after each
  redirect (max 5), and enforces size and time caps. Playwright then navigates with request
  interception that applies the same checks to every sub-request.
- **Contract:** none (`ScanInput.url` already exists). Long scans may switch to `202` + polling.
- **Risk:** SSRF via DNS rebinding. Mitigation: pin the resolved IP for the connection.

## Crawler (multi-page)

- **Plug-in:** a new `services/crawler` that produces a URL list (same-origin, from the sitemap
  first, then links, respecting `robots.txt`) and feeds the orchestrator. Results group into a
  `Site` resource holding many `Scan`s.
- **Contract:** additive `/sites` endpoints. Site score = element-weighted aggregate using the
  same formula (doc 06).
- **Dedupe win:** shared headers and footers produce the same signatures, so one fix is reused
  across pages. That is a major token and effort saver.
- **Risk:** cost explosion. Cap pages per plan and charge browser seconds.

## SPA hydration

- **Plug-in:** a scanner "ready" strategy: `load` → network idle → DOM-mutation quiet period
  (e.g. 500 ms without mutations) → optional user-supplied `waitFor` selector, all under the scan
  timeout.
- **Contract:** `ScanOptions.waitFor` (additive).
- **Risk:** infinite spinners. The quiet-period timeout always wins, and the scan is reported as
  "scanned at timeout".

## Auth cookies / gated pages

- **Plug-in:** a per-scan Playwright `storageState` (cookies + localStorage) injected into the
  isolated context. Never shared, and never logged.
- **Contract:** `ScanOptions.auth` (additive), encrypted at rest with a short TTL and deleted after
  the scan.
- **Risk:** credential handling. Requires accounts and a security review first; enterprise
  self-hosted runners are the safer route.

## Keyboard and focus simulation

- **Plug-in:** new `scanner/checks/focus-*.js` that drive `Tab`/`Shift+Tab` in Playwright and
  record the focus order, visible focus (comparing outline/box-shadow before and after focus),
  keyboard traps (focus stuck for N presses), and whether focused elements are hidden.
  Results are axe-shaped with `source: "accessfix"` and mapped to 2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11.
- **Contract:** new rule IDs only.
- **Risk:** flakiness. Use deterministic pages and fixed viewports; low confidence until proven.

## ARIA widget semantics

- **Plug-in:** per-pattern checks (menu, tabs, combobox, dialog) based on the WAI-ARIA Authoring
  Practices, scripting keyboard interactions and checking state changes (`aria-expanded`,
  `aria-selected`).
- **Contract:** new rule IDs. Fixes start as manual review (doc 05) and are promoted per pattern.
- **Risk:** high false-positive risk. Ship as advisory first.

## Source mapping

- **Plug-in:** a post-processor that maps `data-afx-id` → source location. Pathways, from simplest
  to hardest:
  1. Static HTML repos: map directly by matching the DOM path in the file.
  2. Vite/webpack dev builds: framework dev hooks (React `_debugSource` / `data-source` babel
     plugin) give file:line for each element.
  3. Production: source maps + heuristics. Best effort.
- **Contract:** `Patch.sourceLocation` (additive) and a `patchFormat: "jsx"` variant.
- **Risk:** wrong-file edits. Always present as a suggestion; never auto-commit.

## CI action

- **Plug-in:** a thin client over the public API (or the Docker image for self-hosting). It
  builds or serves the site, scans the listed pages, and posts a PR comment with the score
  change, new violations and suggested diffs. `--fail-under 90` and `--fail-on-regression` gates.
- **Contract:** none beyond API keys (Team tier).
- **Risk:** noisy comments. Show only the change from the base branch.

## Multi-language

- **UI and explanations:** message catalog keyed by `ruleId` + locale; axe ships locales via
  `axe.configure({ locale })`.
- **Scanned content:** `html-has-lang` detection already handles many languages; LLM prompts take
  the page language so drafted alt text and labels match it.
- **Contract:** `Accept-Language` header; `Violation.locale` (additive).
- **Risk:** translation quality of explanations. Have native speakers review the catalogs.

## Public API access

- **Plug-in:** API keys (hashed), per-key rate limits and token budgets, and usage metering via
  the existing `recordUsage` repository method.
- **Contract:** the same endpoints with an `Authorization: Bearer` header; `/usage` scoped per key.
- **Prerequisites:** accounts (deliberately postponed) and the Mongo adapter.

## Also parked

- VS Code extension (growth channel, doc 02): reuses the API; code actions from `Patch`.
- Colour-blindness and screen-reader "experience" simulations in the preview (from the original
  research). Nice for demos, but they don't fix anything, so they come after the core loop.
- Lighthouse as a second engine: possible comparison view; never a second source of detection
  in the score.
