import { CircleCheck, Circle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

export const STEPS = [
  { stage: 'queued', label: 'Waiting for a free scanner' },
  { stage: 'loading', label: 'Loading the page' },
  { stage: 'rendering', label: 'Letting it finish rendering' },
  { stage: 'checking', label: 'Running accessibility checks' },
  { stage: 'normalizing', label: 'Writing up the results' },
];

/** @param {{ stage: import('@/lib/api.js').Stage | 'submitting', onCancel: () => void }} props */
export function ScanProgress({ stage, onCancel }) {
  const current =
    stage === 'submitting'
      ? 0
      : Math.max(
          0,
          STEPS.findIndex((s) => s.stage === stage),
        );
  const label = STEPS[current].label;

  return (
    <section aria-labelledby="progress-heading" className="rounded-lg border bg-surface p-4 sm:p-6">
      <h2 id="progress-heading" className="text-lg font-semibold">
        Scanning
      </h2>
      <p role="status" className="sr-only">
        {label}
      </p>
      <ol className="mt-3 space-y-2">
        {STEPS.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'pending';
          const Icon = state === 'done' ? CircleCheck : state === 'current' ? LoaderCircle : Circle;
          return (
            <li
              key={s.stage}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex items-center gap-2 text-sm ${state === 'pending' ? 'text-muted-foreground' : ''}`}
            >
              <Icon
                aria-hidden="true"
                className={`size-4 ${state === 'done' ? 'text-verified' : ''} ${state === 'current' ? 'animate-spin text-primary' : ''}`}
              />
              <span>{s.label}</span>
              <span className="sr-only">
                {state === 'done' ? '(done)' : state === 'current' ? '(in progress)' : '(waiting)'}
              </span>
            </li>
          );
        })}
      </ol>
      <Button variant="outline" size="sm" className="mt-4" onClick={onCancel}>
        Cancel
      </Button>
    </section>
  );
}
