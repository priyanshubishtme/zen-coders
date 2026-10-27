import { ExternalLink, Eye, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { fixStatus, oneLine } from '@/lib/markLayout.js';
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
 *   onFix?: (violationIds: string[]) => void, fixing?: boolean,
 *   marksById?: Record<string, { n: number | null, place: string }>,
 *   numberById?: Record<string, number>,
 *   highlightIds?: string[],
 *   activeId?: string | null, onSelect?: (id: string) => void,
 *   onSelectGroup?: (ids: string[]) => void }} props
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
  marksById = {},
  numberById = {},
  highlightIds = [],
  activeId = null,
  onSelect,
  onSelectGroup,
}) {
  const { first, items } = group;
  const n = items.length;
  const hasRepairs = items.some((v) => repairsByViolation[v.id]);
  const highlighted = items.some((v) => highlightIds.includes(v.id) || v.id === activeId);
  const numbers = items.map((v) => numberById[v.id]).filter((n) => n != null);
  const elements = (
    <ul className="mt-2 space-y-3">
      {items.map((v) => {
        const mark = marksById[v.id];
        return (
          <li
            key={v.id}
            id={`issue-${v.id}`}
            tabIndex={-1}
            className={`rounded-md bg-surface p-3 ${highlightIds.includes(v.id) ? 'ring-2 ring-primary' : ''}`}
          >
            {numberById[v.id] != null && (
              <button
                type="button"
                className="mb-2 min-h-10 rounded-md border px-2 text-sm"
                aria-pressed={highlightIds.includes(v.id)}
                onClick={() => onSelect?.(v.id)}
              >
                Mark {numberById[v.id]}
              </button>
            )}
            {mark?.place === 'offscreen' && (
              <p className="mb-2 text-sm text-muted-foreground">This element was outside the screenshot.</p>
            )}
            {mark?.place === 'frame' && (
              <p className="mb-2 text-sm text-muted-foreground">
                This element is inside another frame, so it has no pin.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Selector:{' '}
              <code className="font-mono text-foreground">{v.node.target.join(' → ')}</code>
            </p>
            <pre className="mt-2 overflow-x-auto rounded border bg-background p-2 font-mono text-xs">
              <code>{v.node.html}</code>
            </pre>
            {v.node.failureSummary && (
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {v.node.failureSummary}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
  const repairs = (
    <ul className="mt-3 space-y-3">
      {items.map((v) => {
        const repair = repairsByViolation[v.id];
        if (!repair) return null;
        return (
          <li key={repair.id}>
            <RepairCard
              repair={repair}
              draft={drafts[repair.id] ?? ''}
              onDraft={(text) => onDraft?.(repair.id, text)}
              accepted={acceptedIds.has(repair.id) || repair.accepted}
              onAccept={() => onAccept?.(repair.id)}
              onReject={() => onReject?.(repair.id)}
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <article
      className={`rounded-lg border bg-background p-4 ${highlighted ? 'ring-2 ring-primary' : ''}`}
      aria-labelledby={`issue-title-${first.id}`}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a, button, input, summary, textarea')) return;
        onSelectGroup?.(items.map((v) => v.id));
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge impact={group.impact} manual={manual} />
        <span className="text-sm text-muted-foreground">
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
      {numbers.length > 0 && (
        <p className="mt-2 text-sm">
          {numbers.length === 1 ? 'Mark' : 'Marks'} {numbers.join(', ')}
        </p>
      )}
      <h3 id={`issue-title-${first.id}`} className="mt-2 max-w-[65ch] text-base font-semibold leading-6">
        {first.title}
      </h3>
      <p className="mt-2 flex items-start gap-1.5 text-sm">
        <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="max-w-[65ch]">
          <span className="font-medium">Who it affects:</span> {first.whoItAffects}
        </span>
      </p>
      {oneLine(first.explanation) && oneLine(first.explanation) !== first.title && (
        <p className="mt-2 max-w-[65ch] text-sm leading-6">
          <span className="font-medium">Why it matters:</span> {first.explanation}
        </p>
      )}
      <p className="mt-2 max-w-[65ch] text-sm leading-6">
        <span className="font-medium">How we fix it:</span>{' '}
        {manual
          ? `Check by hand. ${oneLine(first.explanation) || 'A person needs to look at this.'} Not applied yet.`
          : fixStatus(first.ruleId, items.map((v) => repairsByViolation[v.id]).find(Boolean))}
      </p>

      <details
        className="mt-3"
        ref={(node) => {
          if (node && highlighted) node.open = true;
        }}
      >
        <summary className="min-h-10 cursor-pointer text-sm font-medium text-primary">Details</summary>
        <div className="mt-2">
          <div className="mt-2">
            <WcagChips refs={first.wcag.refs} />
          </div>
          {elements}
          {first.helpUrl && (
            <a
              href={first.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm text-primary underline"
            >
              Rule reference: {first.ruleId}
              <ExternalLink aria-hidden="true" className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      </details>
      {hasRepairs && repairs}
    </article>
  );
}
