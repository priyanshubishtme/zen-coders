import { useId, useState } from 'react';
import {
  CircleCheck,
  Copy,
  Eye,
  Info,
  OctagonAlert,
  Pencil,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DiffViewer } from './DiffViewer.jsx';

const STRATEGIES = {
  deterministic: 'Rule-based',
  llm: 'AI draft',
  template: 'Template',
  manual: 'Manual',
};

const STATUSES = {
  verified: { label: 'Verified', Icon: CircleCheck, className: 'text-verified border-verified' },
  failed: {
    label: 'Still failing',
    Icon: OctagonAlert,
    className: 'text-critical border-critical',
  },
  regressed: { label: 'Regressed', Icon: TriangleAlert, className: 'text-serious border-serious' },
  'needs-input': {
    label: 'Needs your input',
    Icon: Pencil,
    className: 'text-moderate border-moderate',
  },
  'manual-review': {
    label: 'Needs manual review',
    Icon: Eye,
    className: 'border-border text-muted-foreground',
  },
  'not-applied': {
    label: 'Not applied',
    Icon: Info,
    className: 'border-border text-muted-foreground',
  },
  proposed: { label: 'Proposed', Icon: Sparkles, className: 'text-link border-primary' },
};

const CONFIDENCE = { high: 'High', medium: 'Medium', low: 'Low' };

const AI_REVIEW = {
  label: 'AI draft, needs review',
  Icon: Sparkles,
  className: 'text-link border-primary',
};

/**
 * @param {{ repair: import('@/lib/api.js').Repair, draft: string,
 *   onDraft: (text: string) => void, accepted?: boolean,
 *   onAccept?: () => void, onReject?: () => void }} props
 */
export function RepairCard({ repair, draft, onDraft, accepted = false, onAccept, onReject }) {
  const uid = useId();
  const [copied, setCopied] = useState(false);
  const awaitingReview = repair.strategy === 'llm' && repair.status === 'needs-input' && !accepted;
  const status = awaitingReview ? AI_REVIEW : (STATUSES[repair.status] ?? STATUSES.proposed);
  const hintId = `${uid}-hint`;
  const showInput = Boolean(repair.placeholder) || awaitingReview;

  const copy = async () => {
    const text = repair.patch?.copy;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={status.className}>
          <status.Icon aria-hidden="true" className="size-3.5" />
          {status.label}
        </Badge>
        <Badge className="border-border text-muted-foreground">
          {STRATEGIES[repair.strategy]} · {CONFIDENCE[repair.confidence]} confidence
        </Badge>
      </div>
      <p className="text-sm">{repair.rationale}</p>
      {repair.notes.map((n) => (
        <p key={n} className="text-sm text-muted-foreground">
          {n}
        </p>
      ))}
      {repair.verification?.detail && (
        <p className="text-sm text-muted-foreground">{repair.verification.detail}</p>
      )}
      {repair.patch && (
        <>
          <DiffViewer diff={repair.patch.diff} summary={repair.rationale} />
          <Button variant="outline" size="sm" onClick={copy} disabled={!repair.patch.copy}>
            <Copy aria-hidden="true" className="size-3.5" />
            {copied ? 'Copied' : 'Copy fix'}
          </Button>
          {copied && (
            <span role="status" className="sr-only">
              Fix copied to the clipboard
            </span>
          )}
        </>
      )}
      {showInput && (
        <div>
          <label htmlFor={uid} className="block text-sm font-medium">
            Replacement text
          </label>
          <input
            id={uid}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            aria-describedby={hintId}
            className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p id={hintId} className="mt-1 text-xs text-muted-foreground">
            {awaitingReview
              ? 'AI-drafted wording. Accept it or edit, then apply. Plain words only — no HTML or URLs.'
              : `Replaces “${repair.placeholder}”. A patch that still contains TODO: is never applied.`}
          </p>
          {awaitingReview && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onAccept}>
                Accept draft
              </Button>
              <Button variant="ghost" size="sm" onClick={onReject}>
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
