/**
 * Shareable scan report. Untrusted page snippets are escaped; the HTML export
 * contains no scripts.
 */

export const SCORE_DISCLAIMER =
  'Automated checks only. This score covers issues axe-core can detect for WCAG 2.2 AA. Items in "Needs manual review" are not included. A score of 100 does not mean the page is fully accessible.';

export const REPORT_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const ESC = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function buildReport({ scan, repairs, verification, screenshotsAvailable }) {
  return {
    scanId: scan.id,
    generatedAt: new Date().toISOString(),
    input: scan.input,
    page: scan.page,
    before: verification?.before ?? null,
    after: verification?.after ?? scan.score,
    score: scan.score,
    violations: scan.violations,
    remaining: verification?.remaining ?? scan.violations,
    resolved: verification?.resolved ?? [],
    regressions: verification?.regressions ?? [],
    manualReview: scan.manualReview,
    advisory: scan.advisory,
    repairs,
    tokenUsage: scan.tokenUsage,
    verifiedAt: verification?.verifiedAt ?? null,
    disclaimer: SCORE_DISCLAIMER,
    expiresNote: 'Anyone with this link can view the report. Shared links expire after 30 days.',
    screenshotsNote: screenshotsAvailable === false ? 'Screenshots for this scan have expired.' : '',
  };
}

function scoreLine(score) {
  if (!score || score.value == null) return 'N/A (nothing to check)';
  return String(score.value);
}

function checksRows(report) {
  const seen = new Set();
  const rows = [];
  for (const rule of report.score?.rules ?? []) {
    seen.add(rule.ruleId);
    const status = rule.fail > 0 ? 'Failed' : 'Passed';
    rows.push(
      `<tr><td><code>${escapeHtml(rule.ruleId)}</code></td><td>${status}</td><td>${rule.pass + rule.fail}</td><td>${rule.fail}</td></tr>`,
    );
  }
  const manuals = new Map();
  for (const item of report.manualReview ?? []) {
    if (seen.has(item.ruleId)) continue;
    const row = manuals.get(item.ruleId);
    if (row) row.n += 1;
    else manuals.set(item.ruleId, { id: item.ruleId, n: 1 });
  }
  for (const item of manuals.values()) {
    rows.push(
      `<tr><td><code>${escapeHtml(item.id)}</code></td><td>Check by hand</td><td>${item.n}</td><td>—</td></tr>`,
    );
  }
  return rows.join('') || '<tr><td colspan="4">No rule results were stored for this scan.</td></tr>';
}

function checksMarkdown(report) {
  const lines = [];
  const seen = new Set();
  for (const rule of report.score?.rules ?? []) {
    seen.add(rule.ruleId);
    const status = rule.fail > 0 ? 'Failed' : 'Passed';
    lines.push(`- ${rule.ruleId}: ${status} (${rule.pass + rule.fail} checked, ${rule.fail} failing)`);
  }
  const manuals = new Set();
  for (const item of report.manualReview ?? []) {
    if (!seen.has(item.ruleId)) manuals.add(item.ruleId);
  }
  for (const id of manuals) lines.push(`- ${id}: Check by hand`);
  return lines.join('\n') || 'No rule results were stored for this scan.';
}

function issueList(items) {
  return items
    .map(
      (v) =>
        `<li><strong>${escapeHtml(v.title)}</strong> (${escapeHtml(v.ruleId)}, ${escapeHtml(v.impact)})
        <pre>${escapeHtml(v.node?.html ?? '')}</pre></li>`,
    )
    .join('');
}

export function reportToHtml(report) {
  const title = `AccessFix report ${report.scanId}`;
  const before = scoreLine(report.before);
  const after = scoreLine(report.after);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="Content-Security-Policy" content="${REPORT_CSP}"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#0f172a;background:#fff}
  h1{font-size:1.5rem}
  pre{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border:1px solid #cbd5e1;padding:.75rem;font-size:.85rem}
  .note{color:#475569;font-size:.9rem}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #cbd5e1;padding:.4rem .6rem;text-align:left}
</style>
</head>
<body>
<h1>AccessFix report</h1>
<p class="note">${escapeHtml(report.expiresNote)}</p>
${report.screenshotsNote ? `<p class="note">${escapeHtml(report.screenshotsNote)}</p>` : ''}
<p class="note">${escapeHtml(report.disclaimer)}</p>
<table>
  <tr><th>Scan</th><td><code>${escapeHtml(report.scanId)}</code></td></tr>
  <tr><th>Before</th><td>${escapeHtml(before)}</td></tr>
  <tr><th>After</th><td>${escapeHtml(after)}</td></tr>
  <tr><th>Generated</th><td>${escapeHtml(report.generatedAt)}</td></tr>
</table>
<h2>Checks</h2>
<p class="note">Every automated rule that applied to this page. Rules with nothing to check (for example video captions on a page without video) are not listed. A pass is an automated pass, not a WCAG conformance claim.</p>
<table>
  <tr><th>Rule</th><th>Result</th><th>Elements checked</th><th>Failing</th></tr>
  ${checksRows(report)}
</table>
<h2>Resolved (${report.resolved.length})</h2>
<ul>${issueList(report.resolved) || '<li>None</li>'}</ul>
<h2>Remaining (${report.remaining.length})</h2>
<ul>${issueList(report.remaining) || '<li>None</li>'}</ul>
<h2>Needs manual review (${report.manualReview.length})</h2>
<ul>${issueList(report.manualReview) || '<li>None</li>'}</ul>
<h2>Fixes</h2>
<ul>${
    report.repairs
      .map(
        (r) =>
          `<li>${escapeHtml(r.ruleId)} · ${escapeHtml(r.strategy)} · ${escapeHtml(r.status)}
          <pre>${escapeHtml(r.patch?.diff ?? r.rationale)}</pre></li>`,
      )
      .join('') || '<li>None yet</li>'
  }</ul>
</body>
</html>
`;
}

export function reportToMarkdown(report) {
  const line = (v) => `- ${v.title} (${v.ruleId})`;
  return `# AccessFix report

${report.expiresNote}
${report.screenshotsNote ?? ''}

${report.disclaimer}

- Scan: \`${report.scanId}\`
- Before: ${scoreLine(report.before)}
- After: ${scoreLine(report.after)}

## Checks

Every automated rule that applied to this page. Rules with nothing to check are not listed.

${checksMarkdown(report)}

## Resolved

${report.resolved.map(line).join('\n') || 'None'}

## Remaining

${report.remaining.map(line).join('\n') || 'None'}

## Needs manual review

${report.manualReview.map(line).join('\n') || 'None'}
`;
}

export function renderReport(report, format) {
  if (format === 'md') return { type: 'text/markdown', body: reportToMarkdown(report), ext: 'md' };
  if (format === 'html') return { type: 'text/html; charset=utf-8', body: reportToHtml(report), ext: 'html' };
  return { type: 'application/json', body: report, ext: 'json' };
}
