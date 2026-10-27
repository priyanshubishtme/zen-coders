/**
 * Before/after matching. Elements a repair touched carry a data-afx-v marker
 * in BOTH the baseline and the patched copy, so they match exactly. Other
 * elements match by rule + opening tag (their own tag never changes), as a
 * multiset so repeated identical elements are counted correctly.
 */

const MARKER = /\s*data-afx-v="[^"]*"/g;

function openingTag(html) {
  const s = String(html ?? '').replace(MARKER, '');
  const end = s.indexOf('>');
  return end === -1 ? s : s.slice(0, end + 1);
}

/** Every reported element in a raw scan: axe violations (all categories) + our findings. */
export function flatten(raw) {
  const items = [];
  for (const rule of raw.violations) {
    for (const node of rule.nodes) {
      items.push({ ruleId: rule.id, node, marker: node.marker ?? null, html: node.html });
    }
  }
  for (const f of raw.findings ?? []) {
    items.push({ ruleId: f.ruleId, node: f, marker: f.marker ?? null, html: f.html });
  }
  for (const it of items) {
    it.key = it.marker !== null ? `${it.ruleId}|m${it.marker}` : `${it.ruleId}|t${openingTag(it.html)}`;
  }
  return items;
}

/** @returns {{ resolved: object[], remaining: object[], regressions: object[] }} items */
export function compare(baseRaw, afterRaw) {
  const base = flatten(baseRaw);
  const after = flatten(afterRaw);
  const pool = new Map();
  for (const b of base) pool.set(b.key, [...(pool.get(b.key) ?? []), b]);
  const matchedBase = new Set();
  const remaining = [];
  const regressions = [];
  for (const a of after) {
    const candidates = pool.get(a.key);
    if (candidates?.length) {
      matchedBase.add(candidates.shift());
      remaining.push(a);
    } else {
      regressions.push(a);
    }
  }
  return { resolved: base.filter((b) => !matchedBase.has(b)), remaining, regressions, base, after };
}

/** A copy of `raw` keeping only the given reported nodes (for normalizing subsets). */
export function subset(raw, items) {
  const keep = new Set(items.map((i) => i.node));
  return {
    ...raw,
    violations: raw.violations
      .map((r) => ({ ...r, nodes: r.nodes.filter((n) => keep.has(n)) }))
      .filter((r) => r.nodes.length),
    incomplete: [],
    findings: (raw.findings ?? []).filter((f) => keep.has(f)),
  };
}
