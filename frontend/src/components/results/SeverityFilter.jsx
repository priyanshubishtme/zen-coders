import { SEVERITIES } from '@/lib/severity.js';
import { cn } from '@/lib/utils.js';

/**
 * Toggle buttons; an empty selection means "all".
 * @param {{ counts: Record<string, number>, selected: string[], onChange: (s: string[]) => void }} props
 */
export function SeverityFilter({ counts, selected, onChange }) {
  const toggle = (value) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-2">
      {SEVERITIES.map(({ value, label, Icon, className }) => {
        const pressed = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            onClick={() => toggle(value)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm',
              pressed ? `${className} bg-surface font-semibold` : 'border-input text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label} <span className="tabular-nums">({counts[value] ?? 0})</span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="min-h-9 px-2 text-sm text-primary underline"
        >
          Show all
        </button>
      )}
    </div>
  );
}
