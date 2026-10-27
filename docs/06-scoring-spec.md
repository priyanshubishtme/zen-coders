# 06. Scoring spec (formula version 1)

## Formula

```math
\text{score} = \operatorname{round}\left(100 \times \left(1 - \frac{\sum_{r \in R} w_r \cdot \text{fail}_r}{\sum_{r \in R} w_r \cdot (\text{pass}_r + \text{fail}_r)}\right)\right)
```

Plain text: `score = round(100 * (1 - Σ w·fail / Σ w·(pass + fail)))`, summed over the rules in `R`.

| Symbol   | Definition                                                                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `R`      | In-scope **WCAG** rules that _applied_ to the page: axe rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (plus AAA tags only when `includeAAA`), and our own `accessfix` checks mapped to a WCAG criterion, with at least one passing or failing element. Rules axe reports as `inapplicable` are not in `R`. |
| `fail_r` | Number of elements in axe `violations` for rule `r`.                                                                                                                                                                                                                                                                             |
| `pass_r` | Number of elements in axe `passes` for rule `r`.                                                                                                                                                                                                                                                                                 |
| `w_r`    | Fixed weight from [doc 05](05-repair-catalog.md): critical **10**, serious **7**, moderate **3**, minor **1**. Rules not in the catalog get **3**.                                                                                                                                                                               |

Rules for edge cases:

1. **No applicable rules** (`R` is empty, e.g. an empty fragment): `value = null`, shown as **N/A**,
   never 100.
2. **Rounding**: round half up to an integer. A score of 100 is shown only when
   `Σ w·fail = 0`. We never round 99.6 up to 100: values ≥ 99.5 with any failure are capped
   at 99.
3. **The weight is per rule, not per element.** The weight comes from the rule's catalog entry,
   not from axe's per-node impact, so the same rule always weighs the same and before/after scores
   are comparable.
4. **Same engine for before and after.** Verification re-runs the same axe version with the same
   options; `Score.engine.axeVersion` is stored with every score.
5. **One element failing several rules** counts once per rule. That is intended, because each rule
   is a separate barrier.

### Kept out of the score, on purpose

| Bucket            | Source                                                     | Why it is excluded                                    | Shown as                                                     |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| **Manual review** | axe `incomplete` + rules with no automated check           | axe could not decide; counting them would be guessing | Separate count + checklist, always visible next to the score |
| **Advisory**      | axe `best-practice` rules (e.g. `heading-order`, `region`) | Not WCAG success criteria                             | Separate count; still fixable and verifiable                 |
| **Placeholders**  | Patches still containing `TODO:`                           | Not a real fix                                        | Repair stays "needs your input"                              |

## Worked example

| Rule             | Weight | Pass | Fail | w·fail  | w·(pass+fail) |
| ---------------- | ------ | ---- | ---- | ------- | ------------- |
| `image-alt`      | 10     | 6    | 4    | 40      | 100           |
| `color-contrast` | 7      | 30   | 10   | 70      | 280           |
| `label`          | 10     | 2    | 1    | 10      | 30            |
| `html-has-lang`  | 7      | 0    | 1    | 7       | 7             |
| `document-title` | 7      | 1    | 0    | 0       | 7             |
| **Total**        |        |      |      | **127** | **424**       |

score = round(100 × (1 − 127/424)) = round(70.05) = **70**

After verified fixes for 3 images, 10 contrast nodes, the label and `lang`, the weighted
failures drop to 10 → round(100 × (1 − 10/424)) = **98**. Fixing the last image gives **100**.

## What the score means

- "Of the things automated checks can test on this page, weighted by how badly each failure
  blocks people, this share passes."
- It moves with partial progress: fixing 9 of 10 images raises it. This differs from Lighthouse,
  which scores each audit pass/fail
  ([Chrome docs](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)).
- It is comparable before and after on the **same input** with the **same formula version and axe
  version**.

## What the score does not mean

- **Not WCAG conformance.** Automated tools detect only part of WCAG (GDS audit: best tool 40% of
  planted barriers; Deque: axe finds ~57% of issues by volume, see doc 01). A 100 means "no
  detectable failures", not "accessible".
- **Not comparable across pages of different size or type**, and not comparable to Lighthouse,
  WAVE or axe DevTools numbers.
- **Not a measure of content quality.** Correct alt text, meaningful link text and logical reading
  order need human review.

UI copy next to every score (verbatim):

> **Automated checks only.** This score covers issues axe-core can detect for WCAG 2.2 AA.
> Items in "Needs manual review" are not included. A score of 100 does not mean the page
> is fully accessible.

## Bands (labels always shown with icon + text)

| Range  | Label            |
| ------ | ---------------- |
| 90–100 | Good             |
| 50–89  | Needs work       |
| 0–49   | Poor             |
| N/A    | Nothing to check |

## Changing the formula

Any change bumps `formulaVersion`, keeps the old implementation for stored scans, and updates
this document and `backend/tests/scorer.test.js` in the same PR.
