# 05. Repair catalog

For each rule: how we fix it, how we prove the fix, and how far to trust it. Implementing a rule
means adding `backend/src/services/repair/rules/<ruleId>.js`, a fixture in
`backend/tests/fixtures/`, and a test. The row in this table comes first.

## Legend

**Strategy**

- **Deterministic**: an algorithm produces the full patch. No LLM, no placeholder.
- **LLM-assisted**: deterministic structure, with _content_ (words) drafted by the LLM. Without
  the LLM, or over budget, it falls back to a template with a `TODO:` placeholder.
- **Manual review**: no safe automated patch. We return `patch: null` plus a specific checklist.

**Verification**

- **RS**: re-scan. The rule passes on the same element (`data-afx-id`) and the page has no new
  violations. Applies to every row that has a patch.
- **CALC**: a pre-check before re-scan, e.g. the computed contrast ratio meets the target.
- **HUMAN**: the content must be reviewed by a person (`needsHumanInput: true`). The re-scan
  proves the structure is fixed, not that the words are right. The UI shows "AI draft – review".

**Confidence** (shown on every repair)

- **High**: the patch is unambiguous and cannot change meaning or behaviour.
- **Medium**: the patch is correct for the rule but may change appearance or need a judgment
  check.
- **Low**: best effort; expect edits.

**Weight** is the fixed impact weight used by the scorer (doc 06): critical 10, serious 7,
moderate 3, minor 1. These match the weights Lighthouse uses for the same axe rules
([Chrome docs](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)).
**Advisory** rules are axe `best-practice` rules: we fix them, but they never change the score.

## Rules: the WebAIM top six first

| Rule ID                   | WCAG           | Weight | Strategy                         | What the fix does                                                                                                                                                                                                                                                                                          | Verification       | Confidence                                    | Phase             |
| ------------------------- | -------------- | ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------- | ----------------- |
| `color-contrast`          | 1.4.3 AA       | 7      | Deterministic                    | Uses axe's measured foreground/background and required ratio. Keeps hue and saturation and binary-searches lightness (OKLCH) of the foreground to target + 0.1 margin; if impossible, adjusts the background. Patches the matching `<style>` rule if one selector owns the colour, else an inline `style`. | CALC + RS          | High (foreground), Medium (background change) | 1                 |
| `image-alt` (decorative)  | 1.1.1 A        | 10     | Deterministic                    | `alt=""` when the image is decorative by evidence: `role="presentation"`/`none`, ≤ 2×2 px or spacer filename, or inside a link/button that already has a text name.                                                                                                                                        | RS                 | High                                          | 1                 |
| `image-alt` (informative) | 1.1.1 A        | 10     | LLM-assisted                     | Vision model drafts `alt` (≤ 125 chars) from the image + nearby text; text-only fallback uses filename + caption + surrounding text. Template: `alt="TODO: describe the image"`.                                                                                                                           | RS + HUMAN         | Medium (vision), Low (text-only)              | 1 template, 3 LLM |
| `label`                   | 1.3.1, 4.1.2 A | 10     | Deterministic, then LLM-assisted | (a) Visible text immediately before/around the control -> wrap or add `<label for>` (generating `id` if missing). (b) Else `aria-label` from `placeholder`/`title`. (c) Else the LLM drafts a visible label from `name`, `type` and form context; template `TODO:`.                                        | RS (+ HUMAN for c) | High (a), Medium (b), Low (c)                 | 1 (a, b), 3 (c)   |
| `link-name`               | 2.4.4, 4.1.2 A | 7      | Deterministic, then LLM-assisted | (a) Icon with an existing `title`/`<title>`/`alt` -> promote it to the accessible name. (b) Else the LLM drafts an `aria-label` from `href`, icon class and context. Template `TODO:`.                                                                                                                     | RS (+ HUMAN for b) | High (a), Medium (b)                          | 1 (a), 3 (b)      |
| `button-name`             | 4.1.2 A        | 10     | Deterministic, then LLM-assisted | Same as `link-name`; also uses `value` and known icon class names (`close`, `menu`, `search`).                                                                                                                                                                                                             | RS (+ HUMAN)       | High / Medium                                 | 1 / 3             |
| `html-has-lang`           | 3.1.1 A        | 7      | Deterministic                    | Adds `lang` to `<html>`. Language is detected from the page text with a small n-gram detector; if confidence is low, `en` with the repair flagged for review.                                                                                                                                              | RS                 | High (detected), Medium (default)             | 1                 |

## Other deterministic rules

| Rule ID                                     | WCAG           | Weight | What the fix does                                                                    | Verification | Confidence                | Phase |
| ------------------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------ | ------------ | ------------------------- | ----- |
| `html-lang-valid`                           | 3.1.1 A        | 7      | Maps common mistakes (`english` -> `en`, `en_US` -> `en-US`) via a BCP 47 table.     | RS           | High                      | 1     |
| `valid-lang`                                | 3.1.2 AA       | 7      | Same mapping on inner `lang` attributes.                                             | RS           | High                      | 1     |
| `document-title`                            | 2.4.2 A        | 7      | `<title>` from the first `<h1>`, else the first heading, else template.              | RS           | Medium                    | 1     |
| `meta-viewport`                             | 1.4.4 AA       | 10     | Removes `user-scalable=no`; raises `maximum-scale` to ≥ 5.                           | RS           | High                      | 1     |
| `meta-refresh`                              | 2.2.1 A        | 10     | Removes a timed refresh (`content` > 0) and suggests a link instead.                 | RS           | Medium                    | 1     |
| `link-in-text-block`                        | 1.4.1 A        | 7      | Adds `text-decoration: underline` to in-text links.                                  | RS           | High                      | 1     |
| `select-name`                               | 1.3.1, 4.1.2 A | 10     | Same algorithm as `label` (a, b).                                                    | RS           | High / Medium             | 1     |
| `input-button-name`                         | 4.1.2 A        | 10     | Adds `value` for `submit`/`reset` defaults; else LLM-assisted.                       | RS           | High / Medium             | 1 / 3 |
| `input-image-alt`                           | 1.1.1, 4.1.2 A | 10     | `alt` from the form's purpose (e.g. "Search", "Submit"); else LLM-assisted.          | RS (+ HUMAN) | Medium                    | 1 / 3 |
| `frame-title`                               | 4.1.2 A        | 7      | `title` from the `src` host/path pattern (YouTube, Maps, ...); else template.        | RS (+ HUMAN) | Medium                    | 1     |
| `aria-hidden-focus`                         | 4.1.2 A        | 7      | Adds `tabindex="-1"` to focusable descendants of `aria-hidden="true"`.               | RS           | Medium                    | 1     |
| `scrollable-region-focusable`               | 2.1.1 A        | 7      | Adds `tabindex="0"` (+ `role="region"` and a label if missing).                      | RS           | Medium                    | 1     |
| `list`, `listitem`                          | 1.3.1 A        | 7      | Moves stray children into `<li>`, or wraps stray `<li>` in a `<ul>`.                 | RS           | Medium                    | 1     |
| `duplicate-id-aria`                         | 4.1.2 A        | 10     | Renames later duplicates and rewrites the ARIA references that should point to them. | RS           | Medium                    | 1     |
| `aria-valid-attr`                           | 4.1.2 A        | 10     | Fixes known misspellings (`aria-labeledby` -> `aria-labelledby`); else removes.      | RS           | High / Medium             | 1     |
| `aria-allowed-attr`, `aria-prohibited-attr` | 4.1.2 A        | 10     | Removes the attribute not allowed on that role.                                      | RS           | Medium                    | 1     |
| `target-size`                               | 2.5.8 AA (2.2) | 7      | `min-width`/`min-height: 24px` (or spacing) on the target.                           | RS           | Medium (layout may shift) | 1     |
| `autocomplete-valid`                        | 1.3.5 AA       | 7      | Maps near-misses to valid tokens (`e-mail` -> `email`); else removes.                | RS           | Medium                    | 1     |

## Advisory (best-practice) rules: fixed, never scored

| Rule ID                | Weight (unscored) | What the fix does                                                                                                        | Confidence | Phase |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | ----- |
| `heading-order`        | 3                 | Re-levels a heading to previous level + 1 (`h1 -> h4` becomes `h2`), adding a class that keeps the original visual size. | Medium     | 1     |
| `page-has-heading-one` | 3                 | Promotes the first prominent heading to `h1`; else template.                                                             | Medium     | 1     |
| `landmark-one-main`    | 3                 | Wraps the content between header and footer in `<main>`.                                                                 | Medium     | 1     |
| `region`               | 3                 | Wraps orphan content in the nearest suitable landmark.                                                                   | Low        | 1     |
| `tabindex`             | 3                 | Sets `tabindex > 0` to `0`.                                                                                              | High       | 1     |
| `empty-heading`        | 1                 | Removes the empty heading, or manual if it is a layout hook.                                                             | Medium     | 1     |

## Manual review: no automated patch

Each returns a specific "how to check" list instead of a patch.

| Rule ID                                                        | WCAG    | Weight | Why no patch                                                                                                    |
| -------------------------------------------------------------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `video-caption`                                                | 1.2.2 A | 10     | Captions need a transcript of real speech.                                                                      |
| `audio-caption` / media alternatives                           | 1.2.x   | 10     | Same.                                                                                                           |
| `aria-required-children`, `aria-required-parent`, `aria-roles` | 4.1.2 A | 10     | Widget semantics need intent (roadmap: ARIA widget patterns).                                                   |
| `nested-interactive`                                           | 4.1.2 A | 7      | Restructuring interactive elements changes behaviour.                                                           |
| `td-headers-attr`, `th-has-data-cells`, `td-has-header`        | 1.3.1 A | 7–10   | Table semantics need intent.                                                                                    |
| `bypass`                                                       | 2.4.1 A | 7      | A skip link is safe, but where it should point is a design decision. Deterministic suggestion, manual approval. |
| Any axe "incomplete" result                                    | —       | —      | axe itself could not decide; it goes to the manual-review bucket and is never scored.                           |

## Coverage policy

- A Phase 1 test lists every axe rule tagged for our standard and fails if any is missing from
  this catalog. Unlisted rules default to **manual review** with weight 3 (moderate) and are logged.
- A rule moves up a confidence level only after its fixer passes 20+ varied fixtures with zero
  regressions.
- The placeholder marker is `TODO:`. A patch containing it is never applied during verification
  and never counts toward the score (doc 04, `VerifyBody`).
