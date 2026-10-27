import { useEffect, useState } from 'react';
import { API_BASE_URL, getReport, getShare } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { formatScore } from '@/lib/score.js';
import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Info } from 'lucide-react';

export function ReportPage({ id, shareToken }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = shareToken ? getShare(shareToken) : getReport(id, 'json');
    load.then(setReport).catch(setError);
  }, [id, shareToken]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (error) {
    return (
      <Alert tone="error" title="Report not found">
        {error.message} Shared links expire after 30 days.
      </Alert>
    );
  }
  if (!report) return <p>Loading report…</p>;

  const htmlUrl = `${API_BASE_URL}/scans/${encodeURIComponent(id)}/report?format=html`;
  const jsonUrl = `${API_BASE_URL}/scans/${encodeURIComponent(id)}/report?format=json`;
  const mdUrl = `${API_BASE_URL}/scans/${encodeURIComponent(id)}/report?format=md`;

  return (
    <article>
      <h1 className="text-2xl font-semibold">Scan report</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{report.scanId}</p>
      <Alert tone="info" icon={Info} className="mt-4" role="note">
        Anyone with this link can view the report. Shared links expire after about 30 days.
      </Alert>
      <p className="mt-4 text-sm text-muted-foreground">{report.disclaimer}</p>
      {report.screenshotsNote && <p className="mt-2 text-sm">{report.screenshotsNote}</p>}
      <p className="mt-4 text-3xl font-semibold">
        {formatScore(report.before?.value)} → {formatScore(report.after?.value ?? report.score?.value)}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="outline" onClick={share}>
          {copied ? 'Link copied' : 'Copy share link'}
        </Button>
        {!shareToken && (
          <>
            <a className="inline-flex min-h-10 items-center text-sm text-primary underline" href={htmlUrl}>
              Download HTML
            </a>
            <a className="inline-flex min-h-10 items-center text-sm text-primary underline" href={jsonUrl}>
              Download JSON
            </a>
            <a className="inline-flex min-h-10 items-center text-sm text-primary underline" href={mdUrl}>
              Download Markdown
            </a>
          </>
        )}
      </div>
      <section className="mt-8" aria-labelledby="resolved-h">
        <h2 id="resolved-h" className="text-lg font-semibold">
          Resolved ({report.resolved.length})
        </h2>
        <IssueList items={report.resolved} empty="No verified fixes yet." />
      </section>
      <section className="mt-6" aria-labelledby="remain-h">
        <h2 id="remain-h" className="text-lg font-semibold">
          Remaining ({report.remaining.length})
        </h2>
        <IssueList items={report.remaining} empty="Nothing remaining." />
      </section>
      <section className="mt-6" aria-labelledby="manual-h">
        <h2 id="manual-h" className="text-lg font-semibold">
          Needs manual review ({report.manualReview.length})
        </h2>
        <IssueList items={report.manualReview} empty="Nothing flagged." />
      </section>
      <p className="mt-8">
        <Link href="/" className="text-primary underline">
          Back to scan
        </Link>
      </p>
    </article>
  );
}

function IssueList({ items, empty }) {
  if (!items.length) return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-2 list-disc pl-5">
      {items.map((v) => (
        <li key={v.id ?? `${v.ruleId}-${v.node?.html}`}>
          {v.title} ({v.ruleId})
        </li>
      ))}
    </ul>
  );
}
