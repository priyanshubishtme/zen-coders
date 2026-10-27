import { CircleCheck, Download, OctagonAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert.jsx';
import { patchedHtmlUrl } from '@/lib/api.js';
import { groupByRule } from '@/lib/severity.js';
import { IssueGroup } from './IssueGroup.jsx';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Bucket({ id, title, items, empty, tone }) {
  const groups = groupByRule(items);
  return (
    <section aria-labelledby={id} className="mt-6">
      <h3 id={id} className="text-base font-semibold">
        {title} ({items.length})
      </h3>
      {groups.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul
          className={`mt-2 space-y-3 ${tone === 'error' ? 'rounded-lg border border-critical p-3' : ''}`}
        >
          {groups.map((g) => (
            <li key={g.ruleId}>
              <IssueGroup group={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * After apply: resolved / remaining / regressions, download, sandboxed preview.
 * @param {{ verification: import('@/lib/api.js').VerificationResult }} props
 */
export function VerificationPanel({ verification }) {
  const v = verification;
  const ok = v.status === 'verified';
  return (
    <div className="mt-6 rounded-lg border bg-background p-4">
      <Alert
        tone={v.regressions.length ? 'error' : ok ? 'info' : 'warning'}
        icon={v.regressions.length ? OctagonAlert : CircleCheck}
        title={
          v.regressions.length
            ? 'Some fixes introduced new issues'
            : ok
              ? 'Verified fixes applied to a copy'
              : 'Some fixes could not be applied'
        }
        role={v.regressions.length ? 'alert' : 'status'}
      >
        <p>
          {plural(v.resolved.length, 'issue')} resolved
          {v.remaining.length ? ` · ${plural(v.remaining.length, 'issue')} remaining` : ''}
          {v.regressions.length ? ` · ${plural(v.regressions.length, 'regression')}` : ''}
          {` · re-scanned in ${(v.durationMs / 1000).toFixed(1)} s`}
        </p>
      </Alert>

      <div className="mt-4">
        <a
          href={patchedHtmlUrl(v.scanId)}
          download
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-surface"
        >
          <Download aria-hidden="true" className="size-4" />
          Download patched HTML
        </a>
      </div>

      <details className="mt-4">
        <summary className="min-h-6 cursor-pointer text-sm font-medium text-primary">
          Preview patched page
        </summary>
        <iframe
          title="Patched page preview"
          sandbox=""
          srcDoc={v.patchedHtml}
          className="mt-2 h-80 w-full rounded-md border bg-white"
        />
      </details>

      <Bucket
        id="resolved-heading"
        title="Resolved"
        items={v.resolved}
        empty="Nothing was marked resolved."
      />
      <Bucket
        id="remaining-heading"
        title="Remaining"
        items={v.remaining}
        empty="No automated WCAG issues remain."
      />
      <Bucket
        id="regressions-heading"
        title="Regressions"
        items={v.regressions}
        empty="No new issues were introduced."
        tone={v.regressions.length ? 'error' : undefined}
      />
    </div>
  );
}
