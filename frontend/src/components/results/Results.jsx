import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, Globe, Info, LoaderCircle, ShieldOff, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ErrorPanel } from '@/components/ErrorPanel.jsx';
import { useRepairs } from '@/hooks/useRepairs.js';
import { useSeverityParam } from '@/hooks/useSeverityParam.js';
import { getScan } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { visualOn } from '@/lib/flags.js';
import { SCORE_DISCLAIMER, applicableRepairs } from '@/lib/score.js';
import { groupByRule } from '@/lib/severity.js';
import { HeadingOutline } from './HeadingOutline.jsx';
import { IssueGroup } from './IssueGroup.jsx';
import { ScoreExplain } from './ScoreExplain.jsx';
import { ScoreMeter } from './ScoreMeter.jsx';
import { SeverityFilter } from './SeverityFilter.jsx';
import { VerificationPanel } from './VerificationPanel.jsx';
import { Workbench } from './Workbench.jsx';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function ScoreCard({ scan, verification, headingRef }) {
  const score = verification?.after ?? scan.score;
  const previous = verification ? verification.before : null;
  const source =
    scan.input.type === 'url'
      ? (scan.page?.finalUrl ?? scan.input.url)
      : `Pasted HTML (${(scan.input.bytes / 1024).toFixed(1)} KB)`;
  const issues = groupByRule(scan.violations).length;
  return (
    <div className="rounded-lg border bg-surface p-4 sm:p-6">
      <h2 ref={headingRef} id="score-heading" tabIndex={-1} className="text-lg font-semibold">
        Accessibility score
      </h2>
      <div className="mt-4">
        <ScoreMeter score={score} previous={previous} />
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
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
      <p className="mt-2 text-xs text-muted-foreground">{SCORE_DISCLAIMER}</p>
      <p className="mt-3">
        <Link href={`/scans/${scan.id}/report`} className="text-sm text-primary underline">
          Open shareable report
        </Link>
        <span className="ml-2 text-xs text-muted-foreground">
          Anyone with the link can view it. Links expire after 30 days.
        </span>
      </p>
      {score && <ScoreExplain score={score} />}
    </div>
  );
}

function formatCount(n) {
  return new Intl.NumberFormat().format(n);
}

function EfficiencyPanel({ usage }) {
  if (!usage) return null;
  if (!usage.calls && !usage.naiveEstimateTokens && !usage.cacheHits) return null;
  const naiveLine = `A naive one-call-per-issue approach would have used about ${formatCount(usage.naiveEstimateTokens)} tokens.`;
  return (
    <aside className="mt-4 rounded-lg border bg-surface p-4" aria-labelledby="efficiency-heading">
      <h3 id="efficiency-heading" className="text-sm font-semibold">
        Efficiency
      </h3>
      <p className="mt-2 text-sm">
        {formatCount(usage.totalTokens)} tokens used · {formatCount(usage.tokensSaved)} saved ·{' '}
        {formatCount(usage.cacheHits)} cache {usage.cacheHits === 1 ? 'hit' : 'hits'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{naiveLine}</p>
    </aside>
  );
}

function FixBar({
  scan,
  repairs,
  llmOff,
  llmPaused,
  useAi,
  onUseAi,
  proposing,
  applying,
  onPropose,
  onApply,
}) {
  const applicable = applicableRepairs(repairs.repairs, repairs.drafts, repairs.acceptedIds);
  const busy = proposing || applying;
  const canFix = scan.violations.length + scan.advisory.length > 0;
  return (
    <div className="mt-4 space-y-3">
      {llmOff && (
        <Alert tone="info" icon={Info} role="note">
          AI suggestions are off. Rule-based fixes still work.
        </Alert>
      )}
      {llmPaused && (
        <Alert tone="info" icon={Info} role="note">
          AI suggestions paused. Showing templates you can fill in.
        </Alert>
      )}
      {repairs.summary?.needsInput > 0 && (
        <Alert tone="info" icon={Info} role="status">
          {plural(repairs.summary.needsInput, 'fix')}{' '}
          {repairs.summary.needsInput === 1 ? 'needs' : 'need'} your input.{' '}
          <a href="#issues-heading" className="font-medium text-primary underline">
            Review them
          </a>
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        {canFix && (
          <Button onClick={() => onPropose()} disabled={busy} aria-busy={proposing}>
            {proposing ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {proposing ? 'Finding fixes…' : 'Suggest fixes'}
          </Button>
        )}
        {repairs.repairs.length > 0 && (
          <Button
            variant="outline"
            onClick={onApply}
            disabled={busy || (applicable.length === 0 && repairs.rejectedIds.size === 0)}
            aria-busy={applying}
          >
            {applying ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <CircleCheck aria-hidden="true" className="size-4" />
            )}
            {applying ? 'Verifying…' : 'Apply verified fixes'}
          </Button>
        )}
        {!llmOff && !llmPaused && (
          <label className="inline-flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => onUseAi(e.target.checked)}
              className="size-4 accent-primary"
            />
            Use AI drafts
          </label>
        )}
      </div>
      {repairs.summary && (
        <p role="status" className="text-sm text-muted-foreground">
          {[
            `${repairs.summary.verified} verified`,
            repairs.summary.needsInput
              ? `${repairs.summary.needsInput} ${repairs.summary.needsInput === 1 ? 'needs' : 'need'} your input`
              : null,
            repairs.summary.manual ? `${repairs.summary.manual} manual` : null,
            repairs.summary.failed ? `${repairs.summary.failed} still failing` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
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

/**
 * @param {{ scan: import('@/lib/api.js').Scan, health?: import('@/lib/api.js').Health | null }} props
 */
export function Results({ scan, health = null }) {
  const headingRef = useRef(null);
  const [severity, setSeverity] = useSeverityParam();
  const [useAi, setUseAi] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [freshShots, setFreshShots] = useState(null);
  const llmOn = health?.checks.llm === 'on';
  const llmPaused = health?.checks.llm === 'circuit-open';
  const repairs = useRepairs(scan.id, { useLlm: llmOn && useAi });

  useEffect(() => headingRef.current?.focus(), [scan.id]);

  useEffect(() => {
    if (!repairs.verification) return undefined;
    const ctrl = new AbortController();
    getScan(scan.id, ctrl.signal)
      .then((fresh) => setFreshShots(fresh.shots ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [repairs.verification, scan.id]);

  const groups = useMemo(() => groupByRule(scan.violations), [scan.violations]);
  const counts = useMemo(
    () => groups.reduce((acc, g) => ({ ...acc, [g.impact]: (acc[g.impact] ?? 0) + 1 }), {}),
    [groups],
  );
  const visible = severity.length ? groups.filter((g) => severity.includes(g.impact)) : groups;
  const manual = useMemo(() => groupByRule(scan.manualReview), [scan.manualReview]);
  const advisory = useMemo(() => groupByRule(scan.advisory), [scan.advisory]);
  const repairsByViolation = useMemo(
    () => Object.fromEntries(repairs.repairs.map((r) => [r.violationId, r])),
    [repairs.repairs],
  );
  const marksById = useMemo(
    () => Object.fromEntries((scan.marks ?? []).map((mark) => [mark.violationId, mark])),
    [scan.marks],
  );
  const issueProps = {
    marksById,
    activeId,
    onSelect: setActiveId,
    repairsByViolation,
    drafts: repairs.drafts,
    onDraft: repairs.setDraft,
    acceptedIds: repairs.acceptedIds,
    onAccept: repairs.accept,
    onReject: repairs.reject,
    onFix: repairs.propose,
    fixing: repairs.phase === 'proposing',
  };

  return (
    <div>
      <ScoreCard scan={scan} verification={repairs.verification} headingRef={headingRef} />

      <FixBar
        scan={scan}
        repairs={repairs}
        llmOff={health?.checks.llm === 'off'}
        llmPaused={llmPaused}
        useAi={useAi}
        onUseAi={setUseAi}
        proposing={repairs.phase === 'proposing'}
        applying={repairs.phase === 'applying'}
        onPropose={repairs.propose}
        onApply={repairs.apply}
      />

      <EfficiencyPanel usage={repairs.tokenUsage} />

      {repairs.error && (
        <div className="mt-4">
          <ErrorPanel error={repairs.error} onRetry={() => repairs.propose()} />
        </div>
      )}

      {repairs.verification && <VerificationPanel verification={repairs.verification} />}

      {visualOn && (
        <Workbench
          scan={{ ...scan, shots: freshShots ?? scan.shots }}
          verification={repairs.verification}
          activeId={activeId}
          onSelect={setActiveId}
        />
      )}

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
                  <IssueGroup group={g} {...issueProps} />
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
                <IssueGroup group={g} {...issueProps} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
