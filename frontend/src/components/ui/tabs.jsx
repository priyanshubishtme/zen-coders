import { useRef } from 'react';
import { cn } from '@/lib/utils.js';

/**
 * WAI-ARIA tabs with automatic activation and arrow-key navigation.
 * @param {{ id: string, label: string, tabs: { value: string, label: string }[],
 *   value: string, onChange: (v: string) => void, children: (value: string) => import('react').ReactNode }} props
 */
export function Tabs({ id, label, tabs, value, onChange, children }) {
  const refs = useRef({});

  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.value === value);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    onChange(t.value);
    refs.current[t.value]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="inline-flex gap-1 rounded-md bg-surface p-1"
      >
        {tabs.map((t) => {
          const selected = t.value === value;
          return (
            <button
              key={t.value}
              ref={(el) => (refs.current[t.value] = el)}
              type="button"
              role="tab"
              id={`${id}-tab-${t.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.value)}
              onKeyDown={onKeyDown}
              className={cn(
                'min-h-9 rounded px-4 text-sm font-medium',
                selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${value}`}
        className="mt-4"
      >
        {children(value)}
      </div>
    </div>
  );
}
