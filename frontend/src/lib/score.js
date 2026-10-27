import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';

/** Verbatim from docs/06-scoring-spec.md. */
export const SCORE_DISCLAIMER =
  'Automated checks only. This score covers issues axe-core can detect for WCAG 2.2 AA. Items in "Needs manual review" are not included. A score of 100 does not mean the page is fully accessible.';

export const SCORE_BANDS = [
  { min: 90, label: 'Good', Icon: CircleCheck, className: 'text-verified' },
  { min: 50, label: 'Needs work', Icon: TriangleAlert, className: 'text-moderate' },
  { min: 0, label: 'Poor', Icon: OctagonAlert, className: 'text-critical' },
];

export const NA_BAND = {
  label: 'Nothing to check',
  Icon: Info,
  className: 'text-muted-foreground',
};

/** @param {number | null | undefined} value */
export function bandOf(value) {
  if (value == null) return NA_BAND;
  return SCORE_BANDS.find((b) => value >= b.min) ?? SCORE_BANDS.at(-1);
}

/** @param {number | null | undefined} value */
export function formatScore(value) {
  return value == null ? 'N/A' : String(value);
}

/**
 * Repairs that can go into POST /verify: already verified, a filled-in
 * placeholder that no longer contains TODO:, or an accepted AI draft.
 * @param {import('@/lib/api.js').Repair[]} repairs
 * @param {Record<string, string>} drafts
 * @param {Iterable<string>} [acceptedIds]
 */
export function applicableRepairs(repairs, drafts, acceptedIds = []) {
  const accepted = acceptedIds instanceof Set ? acceptedIds : new Set(acceptedIds);
  return repairs.filter((r) => {
    if (r.strategy === 'manual' || r.status === 'failed' || r.status === 'regressed') return false;
    if (r.strategy === 'llm') {
      if (!(r.accepted || accepted.has(r.id))) return false;
      const text = (drafts[r.id] ?? r.draft ?? '').trim();
      return text.length > 0 && !text.includes('TODO:');
    }
    if (r.placeholder) {
      const text = drafts[r.id]?.trim() ?? '';
      return text.length > 0 && !text.includes('TODO:');
    }
    return r.status === 'verified' || r.status === 'proposed';
  });
}
