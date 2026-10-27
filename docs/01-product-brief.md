# 01. Product brief

## What

AccessFix is a web accessibility auditor that ends in fixes, not reports. You paste HTML (and,
from Phase 2, a URL). AccessFix renders it in an isolated headless browser, detects WCAG 2.2 AA
failures with axe-core plus our own deterministic checks, explains each one in plain language
with a severity, and generates a copy-pasteable source patch. You choose which patches to accept;
AccessFix applies them to an isolated copy, re-scans, and marks each fix **verified** only if the
violation disappeared and nothing else broke. The result is a before/after score you can trust,
and patched HTML you can take back to your codebase.

## Why

- Almost every site fails basic, automatically detectable checks. In February 2026, 95.9% of the
  top one million home pages had detectable WCAG 2 failures, averaging 56.1 errors per page
  ([WebAIM Million 2026](https://webaim.org/projects/million/)).
- The failures are repetitive. Six categories (low contrast, missing alt text, missing form
  labels, empty links, empty buttons, missing document language) account for 96% of detected
  errors, and they have been the top six for seven years (same source). These are exactly the
  issues a rules engine can fix.
- Existing scanners tell developers _what_ is wrong, using rule IDs like `color-contrast`, and
  leave the _how_ to the developer. Teams without an accessibility specialist stall at the report.
- Overlay widgets promise one-line compliance but don't change the source. In April 2025 the FTC
  finalized an order requiring accessiBe to pay $1 million and barring it from claiming its
  automated tool can make any site WCAG-compliant without evidence
  ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million)).
- Regulation is real and getting stricter: the European Accessibility Act has applied since 28 June 2025
  ([Council of the EU](https://www.consilium.europa.eu/en/policies/accessibility-goods-services/)).

Who feels it: developers who get an accessibility ticket with a screenshot of a Lighthouse
report, agencies who must hand over "accessible" sites, and, most of all, the estimated
1.3 billion people (16% of the world) living with significant disability
([WHO](https://www.who.int/news-room/fact-sheets/detail/disability-and-health)) who hit these
barriers every day.

## How (the pipeline)

```
input (HTML | URL) -> render in isolated Chromium -> axe-core + deterministic checks
  -> normalize to Violations (plain language, severity, WCAG criterion)
  -> score
  -> repair engine: deterministic fixer -> LLM (judgment only, budgeted) -> template -> manual-review label
  -> user picks fixes -> apply to a copy -> re-scan -> verified / failed / regressed per fix
  -> before/after score + patched HTML + copyable diffs
```

## Target users and jobs-to-be-done

| User                          | Job to be done                                                                                             | What "done" looks like                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Front-end developer (primary) | "When I get an accessibility bug or a failing audit, help me fix it correctly without becoming an expert." | Copyable diff, a reason in one sentence, proof it passed.                      |
| Agency / freelancer           | "Before handover, show the client the site is measurably more accessible."                                 | Before/after score, shareable report, list of manual checks still owed.        |
| QA engineer                   | "Catch regressions before release."                                                                        | Same score on every build; CI gate (roadmap).                                  |
| Designer / content owner      | "Tell me which colours and words to change."                                                               | Contrast-safe colour suggestions, plain-language link text.                    |
| Hackathon judge (demo user)   | "Show me it works, live."                                                                                  | Paste a broken page, watch the score go from red to green with verified fixes. |

## The five USPs, each with a demo proof

| #   | USP                                                                                                      | One-line proof we can demo                                                                             |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Fix-first, not report-first.** Every issue ends in a patch or an honest "needs manual review".         | Filter the issue list by "no next action": it is always empty.                                         |
| 2   | **Real fixes, not overlays.** We change source markup and CSS, never inject runtime widgets.             | Open the patched HTML: a plain diff, no `<script>` added.                                              |
| 3   | **Verified, not claimed.** A fix counts only after a re-scan proves it and nothing regressed.            | Accept a deliberately bad fix: it is marked "regressed", not verified.                                 |
| 4   | **Works with the LLM off.** Deterministic repairs come first; AI is only for judgment calls.             | Run with `LLM_PROVIDER=none`: contrast, `lang`, labels and heading order are still fixed and verified. |
| 5   | **Token cost is a feature.** We show tokens per verified fix and tokens saved versus the naive approach. | Usage panel after a scan: e.g. "40 issues, 6 LLM calls, 87% tokens saved".                             |

## Competitors

| Tool                                                               | What it does                                                                                                                                                                                                                                                                              | What it doesn't                                                                                                        | Our gap                                                                                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **axe DevTools** (Deque): free extension, paid Pro, Axe MCP Server | Industry-standard engine; Pro adds guided tests. Since Feb 2026 the paid Axe MCP Server sends issues to an AI coding agent, which returns code fixes (batches of up to 25, paid by AI credits) ([Deque docs](https://docs.deque.com/devtools-server/4.0.0/en/axe-mcp-server-remediate/)). | AI fixes need a paid plan, AI credits and an MCP coding agent in an IDE. Fixes are LLM-generated for every issue type. | Free and agent-free: paste HTML, get fixes. Deterministic fixes for the most common failures with no credits. Every fix is re-scanned and shown with a before/after score. |
| **WAVE** (WebAIM)                                                  | Visual in-page annotations of errors, alerts and structure; also powers the WebAIM Million.                                                                                                                                                                                               | No code changes or patches; one page at a time in the extension.                                                       | Turns each finding into a patch and verifies it.                                                                                                                           |
| **Lighthouse** (Google)                                            | Weighted 0–100 accessibility score built on axe; each audit is pass/fail with weights from axe impact ([Chrome docs](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)).                                                                                                | No fixes. Pass/fail per audit, so fixing 9 of 10 buttons earns nothing.                                                | Per-element score that rewards partial progress; fixes included.                                                                                                           |
| **Pa11y**                                                          | Open-source CLI and CI runner; HTML_CodeSniffer by default, axe optional ([Pa11y README](https://github.com/pa11y/pa11y)).                                                                                                                                                                | Reports only; no fixes, no explanations beyond rule messages.                                                          | Plain-language explanations, fixes, and (roadmap) a CI action that comments with patches.                                                                                  |
| **Overlay vendors** (e.g. accessiBe, UserWay)                      | Inject a JavaScript widget that modifies the page at runtime.                                                                                                                                                                                                                             | Do not change source; can conflict with assistive tech; regulatory scrutiny (FTC order above).                         | We fix the source and prove it with a re-scan. No runtime script, by principle.                                                                                            |

Honest limit we share with all of them: automated tools detect only part of WCAG. The UK
Government Digital Service planted 142 barriers on a test page; the best tool found 40% and axe found
29% ([GDS audit, last updated 2018](https://alphagov.github.io/accessibility-tool-audit/)). Deque reports
axe finds "on average 57% of WCAG issues", measured by issue volume in its own audit data
([axe-core README](https://github.com/dequelabs/axe-core)). The two figures measure different
things; we quote both and never claim "compliance".

## Sources for every statistic

Status: **verified** = checked against the primary source on 27 Oct 2026.
**Verify before publishing** = not confirmed; do not state as fact.

| Claim                                                    | Value                                                                                                           | Source                                                                                                                                                                          | Status                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Home pages with detected WCAG 2 failures (2026)          | 95.9% (up from 94.8% in 2025)                                                                                   | [WebAIM Million 2026](https://webaim.org/projects/million/)                                                                                                                     | Verified                   |
| Average detected errors per home page                    | 56.1                                                                                                            | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Pages with low-contrast text                             | 83.9%                                                                                                           | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Pages with missing image alt text                        | 53.1%                                                                                                           | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Pages with missing form labels                           | 51%                                                                                                             | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Pages with empty links / empty buttons                   | 46.3% / 30.6%                                                                                                   | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Pages missing document language                          | 13.5%                                                                                                           | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Share of all errors in those six categories              | 96%                                                                                                             | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Form inputs not properly labelled                        | 33.1% of inputs                                                                                                 | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| Pages with skipped heading levels                        | 41.8%                                                                                                           | WebAIM Million 2026                                                                                                                                                             | Verified                   |
| axe-core automatic coverage                              | "on average 57% of WCAG issues" (Deque's own measure, by issue volume)                                          | [axe-core README](https://github.com/dequelabs/axe-core)                                                                                                                        | Verified as a vendor claim |
| Independent tool coverage test                           | Best tool 40%, axe 29% of 142 planted barriers                                                                  | [GDS accessibility tool audit](https://alphagov.github.io/accessibility-tool-audit/) (2018)                                                                                     | Verified, but dated        |
| People with significant disability                       | 1.3 billion, 16% of world population                                                                            | [WHO fact sheet](https://www.who.int/news-room/fact-sheets/detail/disability-and-health)                                                                                        | Verified                   |
| WCAG 2.2 publication                                     | W3C Recommendation 5 Oct 2023; current edition dated 12 Dec 2024                                                | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), [EU digital strategy](https://digital-strategy.ec.europa.eu/en/policies/web-accessibility-directive-standards-and-harmonisation) | Verified                   |
| European Accessibility Act applies                       | 28 June 2025                                                                                                    | [Council of the EU](https://www.consilium.europa.eu/en/policies/accessibility-goods-services/)                                                                                  | Verified                   |
| EN 301 549 v4.1.1 adopts WCAG 2.2                        | Published Sept 2026; not yet cited in the Official Journal, so v3.2.1 (WCAG 2.1 AA) remains the legal reference | [AccessibleEU](https://accessible-eu-centre.ec.europa.eu/content-corner/news/european-accessibility-standard-en-301-549-has-been-updated-2026-09-07_en)                         | Verified                   |
| FTC order against accessiBe                              | $1M; final order 22 Apr 2025                                                                                    | [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million)                                     | Verified                   |
| Lighthouse scoring method                                | Weighted average of pass/fail audits, weights from axe impact                                                   | [Chrome for Developers](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)                                                                                     | Verified                   |
| Pa11y default engine                                     | HTML_CodeSniffer (axe optional)                                                                                 | [Pa11y README](https://github.com/pa11y/pa11y)                                                                                                                                  | Verified                   |
| Deque AI remediation                                     | Axe MCP Server `remediate`, 1–25 issues per batch, AI credits                                                   | [Deque docs](https://docs.deque.com/devtools-server/4.0.0/en/axe-mcp-server-remediate/)                                                                                         | Verified                   |
| Framer "Accessibility Fixer" 0–100 score with categories | —                                                                                                               | Not checked                                                                                                                                                                     | Verify before publishing   |
| "Lighthouse/axe failures mostly boil down to four rules" | —                                                                                                               | Developer blog (anecdotal)                                                                                                                                                      | Verify before publishing   |
| LLM token cost per scan (5–10K tokens for 10 issues)     | —                                                                                                               | Our estimate; to be measured in Phase 3                                                                                                                                         | Verify before publishing   |
| Any LLM price per million tokens                         | —                                                                                                               | Changes often; see doc 07                                                                                                                                                       | Verify before publishing   |

### Corrections to the original research

- **WCAG 2.2 date.** WCAG 2.2 became a Recommendation on 5 Oct 2023; 12 Dec 2024 is the date of the
  current edition, not the first release.
- **Pa11y engine.** Pa11y's default runner is HTML_CodeSniffer, not axe.
- **LLM prices.** The figures for GPT-3.5, GPT-4 and "Claude Code ~$8/M" were outdated or garbled
  and have been dropped. Cost is computed from configured prices (doc 07).
- **"Tools don't generate fixes."** No longer true for Deque's paid tier (see competitors). Our
  difference is deterministic-first, verified, LLM-optional and free to start.
- **"57%" vs "30–40%".** These are different measures (issue volume vs share of planted barriers).
  Always attribute and never combine them.
