# Rule fixers

One file per axe rule ID (`image-alt.js`, `color-contrast.js`, ...), each exporting a `RuleFixer`
(see `../index.js`) and paired with `backend/tests/repair/<ruleId>.test.js`.

The catalog of strategies, verification methods and confidence lives in
[`docs/05-repair-catalog.md`](../../../../../docs/05-repair-catalog.md). Add the rule there first.
