import { useEffect, useMemo, useRef } from 'react';
import { CircleCheck, Globe, Info, ShieldOff } from 'lucide-react';
import { Alert } from '@/components/ui/alert.jsx';
import { useSeverityParam } from '@/hooks/useSeverityParam.js';
import { groupByRule } from '@/lib/severity.js';
import { HeadingOutline } from './HeadingOutline.jsx';
import { IssueGroup } from './IssueGroup.jsx';
import { SeverityFilter } from './SeverityFilter.jsx';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Summary({ scan }) {
  const issues = groupByRule(scan.violations).length;
  const source =
    scan.input.type === 'url'
      ? (scan.page?.finalUrl ?? scan.input.url)
      : `Pasted HTML (${(scan.input.bytes / 1024).toFixed(1)} KB)`;
  return (
    <div className="rounded-lg border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe aria-hidden="true" className="size-4" />
        <span className="truncate">
          {scan.page?.title ? `${scan.page.title} · ` : ''}
          {source}
        </span>
      </p>
      <p className="mt-2 text-2xl font-semibold">
        {plural(issues, 'WCAG issue')}{' '}
        <span className="text-base font-normal text-muted-foreground">
          on {plural(scan.violations.length, 'element')}
        </span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {plural(scan.manualReview.length, 'item')}{' '}
        {scan.manualReview.length === 1 ? 'needs' : 'need'} manual review ·{' '}
        {plural(scan.advisory.length, 'advisory note')}
        {scan.timings.totalMs != null &&
          ` · scanned in ${(scan.timings.totalMs / 1000).toFixed(1)} s`}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Automated checks only (WCAG 2.2 A and AA). They cannot find every barrier.
      </p>
    </div>
  );
}

function Section({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** @param {{ scan: import('@/lib/api.js').Scan }} props */
export function Results({ scan }) {
  const headingRef = useRef(null);
  const [severity, setSeverity] = useSeverityParam();

  useEffect(() => headingRef.current?.focus(), [scan.id]);

  const groups = useMemo(() => groupByRule(scan.violations), [scan.violations]);
  const counts = useMemo(
    () => groups.reduce((acc, g) => ({ ...acc, [g.impact]: (acc[g.impact] ?? 0) + 1 }), {}),
    [groups],
  );
  const visible = severity.length ? groups.filter((g) => severity.includes(g.impact)) : groups;
  const manual = useMemo(() => groupByRule(scan.manualReview), [scan.manualReview]);
  const advisory = useMemo(() => groupByRule(scan.advisory), [scan.advisory]);

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Scan results
      </h2>
      <Summary scan={scan} />

      {scan.network?.blocked > 0 && (
        <Alert tone="info" icon={ShieldOff} className="mt-4" role="note">
          <p>
            {plural(scan.network.blocked, 'resource')} on the page could not be loaded (blocked for
            safety, too large, or failed). Results reflect the page without{' '}
            {scan.network.blocked === 1 ? 'it' : 'them'}.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {scan.network.blockedSamples.slice(0, 3).map((s) => (
              <li key={s.url} className="break-all">
                <code className="font-mono text-xs">{s.url}</code>: {s.reason}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {scan.page && !scan.page.settled && (
        <Alert tone="info" icon={Info} className="mt-4" role="note">
          The page kept loading, so results reflect what had rendered when we checked.
        </Alert>
      )}

      <Section
        id="issues-heading"
        title="Issues"
        description="Grouped by rule. Expand an issue to see each element."
      >
        {groups.length === 0 ? (
          <Alert tone="info" icon={CircleCheck} title="No automated WCAG issues found" role="note">
            That is a good start, not a guarantee. Review the manual checks and advisory notes
            below.
          </Alert>
        ) : (
          <>
            <SeverityFilter counts={counts} selected={severity} onChange={setSeverity} />
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              Showing {plural(visible.length, 'issue')} of {groups.length}.
            </p>
            <ul className="mt-3 space-y-3">
              {visible.map((g) => (
                <li key={g.ruleId}>
                  <IssueGroup group={g} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section
        id="manual-heading"
        title={`Needs manual review (${manual.length})`}
        description="Automated checks could not decide on these. A person needs to look at them. They never count as passed or failed."
      >
        {manual.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing flagged for manual review.</p>
        ) : (
          <ul className="space-y-3">
            {manual.map((g) => (
              <li key={g.ruleId}>
                <IssueGroup group={g} manual />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="advisory-heading"
        title={`Advisory (${advisory.length})`}
        description="Best practices that make pages easier to use. They are not WCAG failures."
      >
        <h3 className="text-sm font-semibold">Heading outline</h3>
        <div className="mt-2 rounded-lg border bg-background p-4">
          <HeadingOutline outline={scan.headingOutline} />
        </div>
        {advisory.length > 0 && (
          <ul className="mt-4 space-y-3">
            {advisory.map((g) => (
              <li key={g.ruleId}>
                <IssueGroup group={g} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
