# 08. UX spec

## User journey (Phase 1)

1. **Paste.** A large code field with a "Try a sample" button that loads a deliberately broken
   page, for demos.
2. **Scan.** One primary button. A progress line shows the stages: rendering, checking, scoring.
3. **Understand.** The score card (with band and the "automated checks only" note) is followed by
   issues grouped by severity. Each issue shows a plain-language title, who it affects, the WCAG
   criterion and how many elements it affects.
4. **Fix.** "Suggest fixes" generates one repair per issue. Each shows a strategy badge
   (Rule-based, AI draft, Template, Manual), its confidence, and a before/after diff with a Copy
   button. Placeholders and AI drafts can be edited inline. LLM drafts show **AI draft, needs
   review** and must be Accepted before Apply; Reject restores the TODO: template.
5. **Verify.** Select fixes (all deterministic fixes are pre-selected) and press "Apply and
   re-scan". Each fix is marked Verified, Still failing or Regressed.
6. **Take it home.** The before/after score, the patched HTML (copy or download), the
   manual-review checklist, and a shareable report (`/scans/:id/report`).

## Screens

| Screen    | Route               | Phase | Purpose                                                          |
| --------- | ------------------- | ----- | ---------------------------------------------------------------- |
| Workspace | `/`                 | 1–4   | Landing pitch + USP + self-scan proof, then paste/scan/fix. Efficiency panel on results. |
| Report    | `/scans/:id/report` | 4     | Read-only shareable report. Anyone with the link can view; expires ~30 days. |
| History   | `/history`          | 4     | This browser’s scans + score trend (Recharts + data table)       |
| Business  | `/business`         | 4     | Content from doc 02                                              |

### Workspace layout

```
┌ header: AccessFix · API status · theme toggle ────────────────────────────┐
│ [Score card: 70 → 98 · Needs work → Good · "Automated checks only"]       │
├──────────────────────────────┬────────────────────────────────────────────┤
│ Issues (list, grouped)       │ Detail                                     │
│  ▸ Critical (5)              │  Title · who is affected · WCAG 1.1.1      │
│  ▸ Serious (11)              │  Fix: [Rule-based · High]  diff  [Copy]    │
│  ▸ Moderate (2)              │  Preview: sandboxed iframe (before/after)  │
│  ▸ Needs manual review (3)   │                                            │
│  ▸ Advisory (4)              │  [Apply and re-scan]                       │
└──────────────────────────────┴────────────────────────────────────────────┘
```

Below 1024 px wide, the two panes stack and the detail view opens as a full-width section with a
"Back to issues" link. Focus moves to its heading.

The preview uses `<iframe sandbox srcdoc>` with no `allow-scripts`, so pasted HTML cannot run in
our origin.

### Workbench (Phase A)

After a scan, the default results view adds a page preview under the score. `VITE_VISUAL=false`
restores the single column.

- One viewport, 1280×720, JPEG. Each failing element with a measured box gets an outline and a numbered badge outside that box. Numbers follow reading order. The badge is a button named `Issue N, severity: what is broken`. A page-level issue (the `html` element, or a box that covers the viewport) is a chip in the Whole page strip, not a dot in the corner. Clicking a mark scrolls the issue list only. Clicking a card highlights every mark for that issue.
- On a wide screen the preview stays on the left and the issues on the right. On a narrow screen they stack. Side by side and Slider compare the before and after screenshots only. A sticky sub-nav jumps to Preview, Issues, Simulators, Screen reader, Keyboard, Engine log, and Code.
- Severity uses color and a shape (octagon, triangle, square, circle). Manual review is a dashed amber “Check by hand” chip, with one line from the explanation already on the issue. A legend and a show/hide marks control sit on the preview.
- The issue card leads with what is broken, who it affects, why it matters, and how we fix it. Before Suggest fixes, that last line is the usual fix and says it has not been applied. Afterward it says automatic, draft to review, or manual. The rule, the WCAG link, and the snippet sit under Details.
- If the picture is missing or expired, the preview says so and the issue list still works.
- Engine log and code start collapsed. The log still streams `GET /scans/:id/events` and keeps the saved events. Filter by stage, export JSON. New lines use `role="status"`. A failed stage uses `role="alert"`.
- Color view buttons read “Red-weak (Protanopia)”, “Green-weak (Deuteranopia)”, and “Blue-weak (Tritanopia)”. The sentence under them says the filter is not a second scan. Problem colors appear only when the scan already stored both colors. The screen-reader table truncates a name at 80 characters. The `html` element reads “Page title / language”. The keyboard panel fixes “1 control was” / “2 controls were”. An empty keyboard list still says focus order was not captured.
- “Show original and patched code” loads Monaco only after that click. The text diff on each repair stays.
- Header theme control: System, Light, Dark. `?theme=light` or `?theme=dark` wins for that load and is what the self-scan opens. The choice from the control is stored in `localStorage` key `accessfix.theme`. Tokens are unchanged.

## States

| State               | Trigger                                                       | What the user sees                                                                                           |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Empty**           | First load                                                    | A short explanation, the paste field, and "Try a sample". No score card.                                     |
| **Scanning**        | `POST /scans` in flight                                       | Button disabled with "Scanning…"; stage text in a polite live region; cancel button.                         |
| **Results**         | Scan completed                                                | Score card + issues. Focus moves to the score heading.                                                       |
| **Clean**           | No violations                                                 | "No automated issues found" + the manual-review checklist (never just "100!").                               |
| **Partial**         | Some fixes are templates or manual, or the LLM budget ran out | Banner: "12 fixes need your input" with a filter link.                                                       |
| **Verifying**       | `POST /verify` in flight                                      | The affected rows show a spinner icon and "Verifying…".                                                      |
| **Error**           | 4xx/5xx                                                       | An inline alert (`role="alert"`) with the plain message, the `requestId`, and a retry action. Input is kept. |
| **Rate-limited**    | 429                                                           | "Too many scans. Try again in 23 s" with a live countdown; the button re-enables when it reaches 0.          |
| **LLM off**         | `/health` → `llm: off`                                        | Neutral note: "AI suggestions are off. Rule-based fixes still work." AI-assisted issues show templates.      |
| **LLM degraded**    | `circuit-open` or budget reached                              | "AI suggestions paused. Showing templates you can fill in."                                                  |
| **Scanner offline** | `/health` → `degraded`                                        | Scan button disabled with the reason; "API online, scanner offline" in the header.                           |

## Accessibility of our own UI (we must pass our own audit)

Release gate from Phase 1: AccessFix scanning its own built pages scores **100** with zero
regressions, and `eslint-plugin-jsx-a11y` (strict) passes.

- Semantic landmarks (`header`, `main`, `nav` where needed), one `h1` per view, logical heading order.
- A skip link to `#main` (already in the shell).
- Everything works by keyboard. The issue list is a list of buttons (no custom grid). The order is
  list → detail → actions.
- Visible focus everywhere: a 2 px `ring` outline with 2 px offset, at least 3:1 contrast.
- Severity, status and score bands always use **icon + text**, never colour alone.
- Live regions: scan stages and verify results use `role="status"`; errors use `role="alert"`.
- `prefers-reduced-motion` disables animation (in `index.css`).
- Works at 400% zoom and a width of 320 CSS px (WCAG 1.4.10); targets are at least 24 × 24 px
  (WCAG 2.5.8).
- Code diffs have a text summary ("Adds alt attribute") before the diff for screen-reader users.
- Charts (Phase 4) always come with a data table alternative.

## Design tokens

Single source: `frontend/src/styles/tokens.js`, mirrored in `frontend/src/index.css`.
`tokens.test.js` re-checks every contrast pair below and fails if CSS and JS drift.

### Light

| Token                             | Value     | On background (#ffffff) | On surface (#f8fafc) | Required |
| --------------------------------- | --------- | ----------------------- | -------------------- | -------- |
| `foreground`                      | `#0f172a` | 17.85                   | 17.06                | 4.5      |
| `muted-foreground`                | `#475569` | 7.58                    | 7.24                 | 4.5      |
| `primary` (teal)                  | `#0f766e` | 5.47                    | 5.23                 | 4.5      |
| `critical`                        | `#b91c1c` | 6.47                    | 6.18                 | 4.5      |
| `serious`                         | `#c2410c` | 5.18                    | 4.95                 | 4.5      |
| `moderate`                        | `#a16207` | 4.92                    | 4.71                 | 4.5      |
| `minor`                           | `#1d4ed8` | 6.70                    | 6.41                 | 4.5      |
| `verified`                        | `#15803d` | 5.02                    | 4.79                 | 4.5      |
| `input` (control border)          | `#64748b` | 4.76                    | 4.55                 | 3.0      |
| `ring` (focus)                    | `#0f766e` | 5.47                    | 5.23                 | 3.0      |
| `primary-foreground` on `primary` | `#ffffff` | 5.47 (on primary)       | —                    | 4.5      |

### Dark

| Token                             | Value     | On background (#020617) | On surface (#0f172a) | Required |
| --------------------------------- | --------- | ----------------------- | -------------------- | -------- |
| `foreground`                      | `#f1f5f9` | 18.41                   | 16.30                | 4.5      |
| `muted-foreground`                | `#94a3b8` | 7.87                    | 6.96                 | 4.5      |
| `primary` (teal)                  | `#2dd4bf` | 10.84                   | 9.59                 | 4.5      |
| `critical`                        | `#f87171` | 7.29                    | 6.45                 | 4.5      |
| `serious`                         | `#fb923c` | 8.91                    | 7.89                 | 4.5      |
| `moderate`                        | `#facc15` | 13.17                   | 11.66                | 4.5      |
| `minor`                           | `#60a5fa` | 7.93                    | 7.02                 | 4.5      |
| `verified`                        | `#4ade80` | 11.58                   | 10.25                | 4.5      |
| `input` (control border)          | `#64748b` | 4.24                    | 3.75                 | 3.0      |
| `ring` (focus)                    | `#2dd4bf` | 10.84                   | 9.59                 | 3.0      |
| `primary-foreground` on `primary` | `#042f2e` | 7.77 (on primary)       | —                    | 4.5      |

`border` (`#cbd5e1` light, `#334155` dark) is decorative only: it separates regions and never
identifies a control on its own. Controls use `input`.

### Severity presentation

| Impact        | Icon (lucide)   | Text                  | Colour token       |
| ------------- | --------------- | --------------------- | ------------------ |
| Critical      | `OctagonAlert`  | "Critical"            | `critical`         |
| Serious       | `TriangleAlert` | "Serious"             | `serious`          |
| Moderate      | `CircleAlert`   | "Moderate"            | `moderate`         |
| Minor         | `Info`          | "Minor"               | `minor`            |
| Verified      | `CircleCheck`   | "Verified"            | `verified`         |
| Manual review | `Eye`           | "Needs manual review" | `muted-foreground` |

### Type, space, shape

- Fonts: the system UI stack for text; the monospace stack (`Cascadia Code`, `SF Mono`, `Consolas`, …)
  for code and diffs. No web fonts, so nothing to load or block on.
- Scale (Tailwind): `text-sm` 14 px for metadata, `text-base` 16 px for body, `text-2xl` for the
  view `h1`, `text-4xl` for the score number.
- Spacing: 4 px grid (Tailwind default). Panes use 16 px padding, cards 24 px.
- Radius: `--radius` 10 px (shadcn default), with `md`/`sm` derived from it.
- Themes: light and dark, following `prefers-color-scheme` at load (toggle in Phase 1).
- Components: shadcn/ui (JavaScript, `components.json` has `tsx: false`) added per need:
  Button, Card, Badge, Tabs, Textarea, Alert, Tooltip, Separator.
