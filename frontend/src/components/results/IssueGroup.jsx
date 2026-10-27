import { ExternalLink, Eye, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { severityOf } from '@/lib/severity.js';
import { RepairCard } from './RepairCard.jsx';

export function SeverityBadge({ impact, manual = false }) {
  if (manual) {
    return (
      <Badge className="border-border text-muted-foreground">
        <Eye aria-hidden="true" className="size-3.5" />
        Needs manual review
      </Badge>
    );
  }
  const s = severityOf(impact);
  return (
    <Badge className={s.className}>
      <s.Icon aria-hidden="true" className="size-3.5" />
      {s.label}
    </Badge>
  );
}

export function WcagChips({ refs }) {
  if (!refs.length) return null;
  return (
    <ul aria-label="WCAG success criteria" className="flex flex-wrap gap-1.5">
      {refs.map((r) => (
        <li key={r.sc}>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-6 items-center gap-1 rounded-md border border-input px-2 text-xs hover:bg-surface"
          >
            {r.sc} {r.name}
            {r.level && ` · ${r.level}`}
            <ExternalLink aria-hidden="true" className="size-3" />
            <span className="sr-only">(opens W3C explanation in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * One rule with all of its affected elements.
 * @param {{ group: { ruleId: string, first: import('@/lib/api.js').Violation, impact: string,
 *   items: import('@/lib/api.js').Violation[] }, manual?: boolean,
 *   repairsByViolation?: Record<string, import('@/lib/api.js').Repair>,
 *   drafts?: Record<string, string>, onDraft?: (id: string, text: string) => void,
 *   acceptedIds?: Set<string>, onAccept?: (id: string) => void, onReject?: (id: string) => void,
 *   onFix?: (violationIds: string[]) => void, fixing?: boolean }} props
 */
export function IssueGroup({
  group,
  manual = false,
  repairsByViolation = {},
  drafts = {},
  onDraft,
  acceptedIds = new Set(),
  onAccept,
  onReject,
  onFix,
  fixing = false,
}) {
  const { first, items } = group;
  const n = items.length;
  const hasRepairs = items.some((v) => repairsByViolation[v.id]);
  const elements = (
    <ul className="mt-2 space-y-3">
      {items.map((v) => {
        const repair = repairsByViolation[v.id];
        return (
          <li key={v.id} className="rounded-md bg-surface p-3">
            <p className="text-xs text-muted-foreground">
              Selector:{' '}
              <code className="font-mono text-foreground">{v.node.target.join(' → ')}</code>
            </p>
            <pre className="mt-2 overflow-x-auto rounded border bg-background p-2 font-mono text-xs">
              <code>{v.node.html}</code>
            </pre>
            {v.node.failureSummary && (
              <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                {v.node.failureSummary}
              </p>
            )}
            {repair && (
              <RepairCard
                repair={repair}
                draft={drafts[repair.id] ?? ''}
                onDraft={(text) => onDraft?.(repair.id, text)}
                accepted={acceptedIds.has(repair.id) || repair.accepted}
                onAccept={() => onAccept?.(repair.id)}
                onReject={() => onReject?.(repair.id)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <article className="rounded-lg border bg-background p-4" aria-labelledby={`issue-${first.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge impact={group.impact} manual={manual} />
        <span className="text-xs text-muted-foreground">
          {n} {n === 1 ? 'element' : 'elements'}
        </span>
        {onFix && !manual && !hasRepairs && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onFix(items.map((v) => v.id))}
            disabled={fixing}
          >
            <Sparkles aria-hidden="true" className="size-3.5" />
            {fixing ? 'Finding fixes…' : 'Fix'}
          </Button>
        )}
      </div>
      <h3 id={`issue-${first.id}`} className="mt-2 font-semibold">
        {first.title}
      </h3>
      <p className="mt-1 text-sm">{first.explanation}</p>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
        <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">Who it affects:</span> {first.whoItAffects}
        </span>
      </p>
      <div className="mt-3">
        <WcagChips refs={first.wcag.refs} />
      </div>

      {hasRepairs ? (
        <div className="mt-3">{elements}</div>
      ) : (
        <details className="mt-3">
          <summary className="min-h-6 cursor-pointer text-sm font-medium text-primary">
            Show {n === 1 ? 'the affected element' : `all ${n} affected elements`}
          </summary>
          {elements}
        </details>
      )}
      {first.helpUrl && (
        <a
          href={first.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline"
        >
          Rule reference: {first.ruleId}
          <ExternalLink aria-hidden="true" className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </article>
  );
}
