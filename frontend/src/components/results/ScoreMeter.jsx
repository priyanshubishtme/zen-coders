import { bandOf, formatScore } from '@/lib/score.js';

const SIZE = 112;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Circular score with band label (icon + text). Colour never stands alone.
 * @param {{ score: import('@/lib/api.js').Score | null, previous?: import('@/lib/api.js').Score | null }} props
 */
export function ScoreMeter({ score, previous = null }) {
  const value = score?.value ?? null;
  const band = bandOf(value);
  const prev = previous?.value;
  const changed = prev != null && prev !== value;
  const pct = value == null ? 0 : value / 100;
  const offset = C * (1 - pct);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className={`relative ${value == null ? '' : band.className}`}
        style={{ width: SIZE, height: SIZE }}
        role={value == null ? undefined : 'meter'}
        aria-labelledby="score-heading"
        aria-valuemin={value == null ? undefined : 0}
        aria-valuemax={value == null ? undefined : 100}
        aria-valuenow={value == null ? undefined : value}
        aria-valuetext={
          value == null
            ? undefined
            : changed
              ? `${value} out of 100, ${band.label}, was ${prev}`
              : `${value} out of 100, ${band.label}`
        }
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
          className="block"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            className="stroke-border"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <p
          aria-hidden={value != null}
          className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-foreground"
        >
          {formatScore(value)}
        </p>
      </div>
      <div>
        <p className={`flex items-center gap-2 text-lg font-semibold ${band.className}`}>
          <band.Icon aria-hidden="true" className="size-5" />
          {band.label}
        </p>
        {changed && (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatScore(prev)} → {formatScore(value)}
          </p>
        )}
        {score && (
          <p className="mt-1 text-sm text-muted-foreground">
            {score.failingElements} failing of {score.elementsChecked} checked elements ·{' '}
            {score.standard}
          </p>
        )}
      </div>
    </div>
  );
}
