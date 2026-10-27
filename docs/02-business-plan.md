# 02. Business plan

> Looking ahead. This is also the source for the in-app `/business` page (Phase 5).
> Every price and conversion rate here is a **hypothesis to test**, not a finding.

## Segments

| Segment                         | Pain                                                          | Buys because                                           | Willingness to pay |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| Indie developers and students   | Got a failing audit and doesn't know the fix                  | Free tier is enough; upgrades for history and AI fixes | Low                |
| Small product teams (2–20 devs) | No accessibility specialist; EAA/ADA pressure from customers  | Fixes plus proof, without a consultant                 | Medium             |
| Agencies and freelancers        | Must prove accessibility at handover across many client sites | Branded before/after reports, many sites, seats        | Medium–high        |
| Enterprises                     | Scale, governance, data residency                             | Self-hosted runner, SSO, bring-your-own model          | High, slow sales   |

## Pricing tiers (hypotheses)

INR prices are localized for India, not straight currency conversions.

|                                              | Free                    | Pro               | Team / Agency                   | Enterprise                            |
| -------------------------------------------- | ----------------------- | ----------------- | ------------------------------- | ------------------------------------- |
| Price                                        | $0                      | $19 / mo (₹1,499) | $79 / mo for 5 seats (₹5,999)   | Custom, from ~$500 / mo               |
| Scans                                        | 20 / mo                 | 500 / mo          | 3,000 / mo pooled, then metered | Contracted                            |
| Input                                        | Pasted HTML, single URL | + saved projects  | + GitHub Action, API            | + self-hosted runner, private network |
| Deterministic fixes + verification           | Yes                     | Yes               | Yes                             | Yes                                   |
| AI-assisted fixes (alt text, names, wording) | ~50 / mo                | Fair use          | Pooled                          | BYO key or local model                |
| History and trends                           | Last 3 scans            | Unlimited         | Unlimited + per-client projects | + export, retention controls          |
| Shareable score report                       | With AccessFix badge    | Unbranded         | White-label                     | White-label + PDF audit pack          |
| Support                                      | Community               | Email             | Priority                        | SLA, SSO, DPA                         |

## Growth channels

1. **GitHub Action** (Team tier hook, free for public repos): runs on pull requests, comments the
   score change and suggested patches. Every comment is visible to the whole team.
2. **VS Code extension**: scans the open HTML/JSX preview and offers our patches as code actions.
3. **Shareable score reports**: a public link with the before/after score and badge. Agencies send
   these to clients, and every report advertises the product.
4. **Content and community**: "Fix of the week" posts on DEV, using real WebAIM Million
   categories; an open-source rule-fixer library to earn developer trust.
5. **Hackathons and education**: free Pro for student teams; accessibility workshops.

## Revenue extras

- Metered scans above plan (e.g. $0.02 per scan, a hypothesis).
- Branded PDF audit packs for agencies (per report).
- Manual-review marketplace: hand the "needs manual review" bucket to vetted auditors and take a
  commission. This is the honest answer to "automation can't do it all".
- Enterprise onboarding and rule customization.

## Unit economics: cost per scan

All costs come from one formula. The numbers below are example inputs; replace them with
measured values in Phase 3.

```math
C_{scan} = t_{browser} \cdot c_{browser\text{-}sec} + \frac{T_{in} \cdot p_{in} + T_{out} \cdot p_{out}}{10^6} + c_{store}
```

Plain text: `cost = browserSeconds * costPerBrowserSecond + (tokensIn * priceIn + tokensOut * priceOut) / 1e6 + storage`.

| Variable        | Meaning                                                | Example input (hypothetical)                                        |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `t_browser`     | Browser seconds per scan, including one verify re-scan | 8 s                                                                 |
| `c_browser-sec` | Cost of one Chromium context-second                    | $48/mo VM, 4 contexts, 70% utilization -> ≈ $0.0000066              |
| `T_in`, `T_out` | Input/output tokens per scan after dedupe and cache    | 2,000 / 500 average; capped at the per-scan budget (8,000)          |
| `p_in`, `p_out` | Model price per 1M tokens (config: `LLM_PRICE_*`)      | $0.15 / $0.60, a placeholder; check your provider's current pricing |
| `c_store`       | Storage per scan                                       | ≈ $0 at this scale                                                  |

Worked example (placeholders):

| Case                                                  | Browser                  | LLM                                         | Total per scan |
| ----------------------------------------------------- | ------------------------ | ------------------------------------------- | -------------- |
| LLM off (deterministic only)                          | 8 × 0.0000066 ≈ $0.00005 | $0                                          | ≈ $0.00005     |
| Typical with LLM                                      | $0.00005                 | (2,000 × 0.15 + 500 × 0.60) / 1e6 = $0.0006 | ≈ $0.00065     |
| Worst case (budget fully spent: 6,000 in + 2,000 out) | $0.00005                 | $0.0021                                     | ≈ $0.0022      |

Implications if the placeholders hold: a Pro user who uses all 500 scans at worst case costs
about $1.10 a month against $19 of revenue, which leaves margin for payment fees, base
infrastructure and support. A free user at 20 scans costs under $0.05. The real risk to margin is
browser time on heavy URLs (Phase 2), not tokens, so URL scans get stricter timeouts and
concurrency caps.

The metrics we report internally match the product's own usage panel: **cost per scan**,
**tokens per verified fix**, and **share of fixes that were deterministic**.

## Moat

1. **Fix engine.** A growing library of tested, deterministic rule fixers, each with fixtures. It's
   slow to copy well, and cheaper to run than LLM-only competitors.
2. **Verification loop.** "Verified" means re-scanned and regression-free. That makes the score trustworthy,
   which is what agencies are really buying.
3. **Workflow integrations.** GitHub Action, VS Code extension and shareable reports put us where
   fixes happen and create switching costs.
4. **Data flywheel (privacy-respecting, opt-in).** Aggregate acceptance and verification rates per
   rule fixer show us which fixes to improve first.

## Risks and honest limits

| Risk                                                                                                                          | Mitigation                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Automated checks cover only part of WCAG** (GDS: best tool 40%; Deque: 57% by issue volume). A 100 score is not compliance. | The score is labelled "automated checks only"; a manual-review bucket is always shown; we never sell "compliance".  |
| Deque and others add AI fixes (already true for the Axe MCP Server).                                                          | Compete on a free start, deterministic and verified fixes, transparent cost, and workflow fit, not on "we have AI". |
| Patching rendered HTML ≠ patching the developer's source (React, templates).                                                  | Patches are small and attribute-level, so they are easy to port; source mapping is on the roadmap (doc 09).         |
| LLM costs or rate limits spike.                                                                                               | Budgets, cache, template fallback; the product works with the LLM off.                                              |
| Wrong fix ships (e.g. inaccurate alt text).                                                                                   | LLM output is always a draft with `needsHumanInput`; only machine-checkable properties are "verified".              |
| URL scanning abuse (SSRF, heavy pages).                                                                                       | Phase 2 hardening: block private IPs, size and time caps, per-IP limits.                                            |
| Legal exposure from overclaiming.                                                                                             | No compliance claims (see the FTC order against accessiBe in doc 01).                                               |
