import { useEffect, useState } from 'react';
import { Check, Download, Link2 } from 'lucide-react';
import { ChecksPanel } from '@/components/results/ChecksPanel.jsx';
import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { API_BASE_URL, createShare, getMe, getReport, getShare } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { ruleText } from '@/lib/rules.js';
import { bandOf, formatScore } from '@/lib/score.js';
import { groupByRule } from '@/lib/severity.js';

export function ReportPage({ id, shareToken }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [owned, setOwned] = useState(false);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(null);

  useEffect(() => {
    const load = shareToken ? getShare(shareToken) : getReport(id, 'json');
    load.then(setReport).catch(setError);
    if (!shareToken) {
      getMe()
        .then((me) => setOwned((me.scanIds ?? []).includes(id)))
        .catch(() => setOwned(false));
    }
  }, [id, shareToken]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    setShareError(null);
    if (!owned) return copy(window.location.href);
    try {
      const created = await createShare(id);
      const url = `${window.location.origin}${created.path}`;
      setLink({ url, expiresAt: created.expiresAt });
      await copy(url);
    } catch (err) {
      setShareError(err.message);
    }
  };

  if (error) {
    return (
      <Alert tone="error" title="Report not found">
        {error.message} Shared links expire after 30 days.
      </Alert>
    );
  }
  if (!report) return <p role="status">Loading report…</p>;

  const scanId = report.scanId ?? id;
  const base = `${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/report?format=`;
  const before = report.before?.value ?? report.score?.value ?? null;
  const after = report.before ? report.after?.value : null;
  const band = bandOf(after ?? before);
  const remaining = groupByRule(report.remaining ?? []);
  const asScan = { score: report.score, violations: report.violations ?? [], manualReview: report.manualReview ?? [] };

  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Accessibility report</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {report.page?.title ? `${report.page.title} · ` : ''}
            {report.page?.finalUrl ?? report.input?.url ?? 'Pasted HTML'} · generated{' '}
            {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={owned ? 'primary' : 'outline'} onClick={share}>
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Link2 aria-hidden="true" className="size-4" />}
            {copied ? 'Link copied' : owned ? 'Create share link' : 'Copy share link'}
          </Button>
          {!shareToken &&
            ['html', 'md', 'json'].map((f) => (
              <a
                key={f}
                href={`${base}${f}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm font-medium hover:bg-raised"
              >
                <Download aria-hidden="true" className="size-4" />
                {f === 'md' ? 'Markdown' : f.toUpperCase()}
              </a>
            ))}
        </div>
      </div>

      {link && (
        <Alert tone="info" role="status" title="Share link created and copied">
          <span className="break-all font-mono text-foreground">{link.url}</span> · expires{' '}
          {new Date(link.expiresAt).toLocaleDateString()}. Anyone with it can view this report.
        </Alert>
      )}
      {shareError && (
        <Alert tone="error" title="Could not create a share link">
          {shareError}
        </Alert>
      )}
      {!owned && !shareToken && (
        <p className="text-sm text-muted-foreground">{report.expiresNote}</p>
      )}

      <section aria-labelledby="summary-h" className="grid gap-6 rounded-xl border bg-surface p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <h2 id="summary-h" className="text-sm font-medium text-muted-foreground">
            Score
          </h2>
          <p className="tabular mt-1 text-5xl font-semibold tracking-tight">
            {after != null ? `${formatScore(before)} → ${formatScore(after)}` : formatScore(before)}
          </p>
          <p className={`mt-2 flex items-center gap-2 font-semibold ${band.className}`}>
            <band.Icon aria-hidden="true" className="size-5" />
            {band.label}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          {[
            ['Resolved', report.resolved.length],
            ['Remaining', report.remaining.length],
            ['Manual review', report.manualReview.length],
            ['Regressions', report.regressions?.length ?? 0],
          ].map(([k, v]) => (
            <div key={k} className="bg-background px-4 py-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm leading-6 text-muted-foreground md:col-span-2">{report.disclaimer}</p>
        {report.screenshotsNote && <p className="text-sm md:col-span-2">{report.screenshotsNote}</p>}
      </section>

      <section aria-labelledby="remain-h" className="rounded-xl border bg-surface p-5 sm:p-6">
        <h2 id="remain-h" className="text-lg font-semibold">
          Remaining ({report.remaining.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Why each one matters and who it blocks.</p>
        {remaining.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing remaining.</p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border bg-background">
            {remaining.map((g) => {
              const t = ruleText(g.ruleId, g.first);
              return (
                <li key={g.ruleId} className="px-4 py-3">
                  <p className="font-medium">
                    {g.first.title}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      · {g.items.length} {g.items.length === 1 ? 'element' : 'elements'} · {g.impact}
                    </span>
                  </p>
                  {t.explanation && <p className="mt-1 max-w-[75ch] text-sm leading-6">{t.explanation}</p>}
                  {g.first.whoItAffects && (
                    <p className="mt-1 text-sm text-muted-foreground">Who it affects: {g.first.whoItAffects}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="resolved-h" className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 id="resolved-h" className="text-lg font-semibold">
            Resolved ({report.resolved.length})
          </h2>
          <IssueList items={report.resolved} empty="No verified fixes yet." />
        </section>
        <section aria-labelledby="manual-h" className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 id="manual-h" className="text-lg font-semibold">
            Needs manual review ({report.manualReview.length})
          </h2>
          <IssueList items={report.manualReview} empty="Nothing flagged." />
        </section>
      </div>

      {report.score && <ChecksPanel scan={asScan} />}

      <p>
        <Link href="/" className="text-link underline">
          Back to scan
        </Link>
      </p>
    </article>
  );
}

function IssueList({ items, empty }) {
  if (!items.length) return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {items.map((v) => (
        <li key={v.id ?? `${v.ruleId}-${v.node?.html}`} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <span>
            {v.title} <span className="text-muted-foreground">({v.ruleId})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
