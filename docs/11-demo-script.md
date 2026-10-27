# 11. Three-minute demo

Target: a judge who has never seen the product. Use the **3-minute demo page**, not the bakery
sample (bakery is ~75 → 95 and is locked for tests).

## Script (~3:00)

1. **0:00 Pitch.** Home page: “Other tools tell you your site is broken. AccessFix fixes it.”
   Point at the comparison table (source patches vs overlays) and the self-scan proof (“no
   automated violations found”).
2. **0:25 Scan.** Click **Load the 3-minute demo page**. Score should land in **Poor** (about 49).
   Name two issues in plain language (unnamed buttons, faint text).
3. **1:10 Fix.** **Suggest fixes**. Open a verified diff (contrast or `lang`). Say: we change the
   source, then re-scan; “verified” means the issue is gone and nothing regressed.
4. **1:50 Apply.** **Apply verified fixes**. Score should land in **Good** (about 98). Leave the
   image-alt template as needs-input so a human still writes the alt text.
5. **2:20 Efficiency.** Tokens used / saved / cache hits, and the naive line. Toggle **Use AI
   drafts** off if you want to show the product works with the LLM off.
6. **2:40 Business.** `/business`: pricing as hypotheses, GitHub Action wedge, honest limits
   (100 ≠ compliance).

If the demo page scores above 50 on first scan, use **Try the broken sample** instead and say the
numbers out loud (75 → 95) rather than forcing the script.

## Aftercare

Shareable report: **Open shareable report**. Say the link is unguessable, anyone who has it can
view it, and it expires in 30 days.
