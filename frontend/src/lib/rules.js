import { RULE_TEMPLATES } from '../../../backend/src/services/scanner/templates/rules.js';

const humanize = (id) => {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Plain-language name and reason for a rule, from the same text the scanner uses. */
export function ruleText(ruleId, fallback = {}) {
  const t = RULE_TEMPLATES[ruleId];
  return {
    title: t?.title ?? fallback.title ?? humanize(ruleId),
    explanation: t?.explanation ?? fallback.explanation ?? null,
    who: t?.who ?? fallback.whoItAffects ?? null,
  };
}

/**
 * One row per rule the scan ran on this page: failed, passed, or check by hand.
 * @param {import('./api.js').Scan} scan
 */
export function buildChecks(scan) {
  const firstViolation = new Map();
  for (const v of scan.violations ?? []) if (!firstViolation.has(v.ruleId)) firstViolation.set(v.ruleId, v);
  const rows = (scan.score?.rules ?? []).map((rule) => {
    const v = firstViolation.get(rule.ruleId);
    const text = ruleText(rule.ruleId, v);
    return {
      ruleId: rule.ruleId,
      status: rule.fail > 0 ? 'failed' : 'passed',
      impact: rule.impact,
      checked: rule.pass + rule.fail,
      failing: rule.fail,
      refs: rule.wcag?.refs ?? v?.wcag.refs ?? [],
      level: rule.wcag?.level ?? v?.wcag.level ?? null,
      violationId: v?.id ?? null,
      ...text,
    };
  });
  const seen = new Set(rows.map((r) => r.ruleId));
  const manual = new Map();
  for (const v of scan.manualReview ?? []) {
    if (seen.has(v.ruleId) && rows.find((r) => r.ruleId === v.ruleId)?.status === 'failed') continue;
    const row = manual.get(v.ruleId);
    if (row) row.checked += 1;
    else
      manual.set(v.ruleId, {
        ruleId: v.ruleId,
        status: 'manual',
        impact: v.impact,
        checked: 1,
        failing: 0,
        refs: v.wcag.refs ?? [],
        level: v.wcag.level ?? null,
        violationId: v.id,
        ...ruleText(v.ruleId, v),
      });
  }
  for (const row of manual.values()) {
    const existing = rows.findIndex((r) => r.ruleId === row.ruleId);
    if (existing >= 0) rows[existing] = { ...rows[existing], status: 'manual', violationId: row.violationId };
    else rows.push(row);
  }
  const order = { failed: 0, manual: 1, passed: 2 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || b.failing - a.failing || a.title.localeCompare(b.title));
}
