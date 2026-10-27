import { CircleAlert, Info, OctagonAlert, TriangleAlert } from 'lucide-react';

/** Severity is always icon + text + colour; never colour alone. */
export const SEVERITIES = [
  {
    value: 'critical',
    label: 'Critical',
    Icon: OctagonAlert,
    className: 'text-critical border-critical',
  },
  {
    value: 'serious',
    label: 'Serious',
    Icon: TriangleAlert,
    className: 'text-serious border-serious',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    Icon: CircleAlert,
    className: 'text-moderate border-moderate',
  },
  { value: 'minor', label: 'Minor', Icon: Info, className: 'text-minor border-minor' },
];

export const severityOf = (impact) => SEVERITIES.find((s) => s.value === impact) ?? SEVERITIES[2];

const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s.value, i]));

/**
 * Group per-element violations by rule, most severe first, then by count.
 * @param {import('@/lib/api.js').Violation[]} violations
 */
export function groupByRule(violations) {
  const groups = new Map();
  for (const v of violations) {
    const g = groups.get(v.ruleId) ?? { ruleId: v.ruleId, first: v, impact: v.impact, items: [] };
    if (RANK[v.impact] < RANK[g.impact]) g.impact = v.impact;
    g.items.push(v);
    groups.set(v.ruleId, g);
  }
  return [...groups.values()].sort(
    (a, b) => RANK[a.impact] - RANK[b.impact] || b.items.length - a.items.length,
  );
}
