import { useEffect, useId, useState } from 'react';

/** Approximate matrices. These recolor our screenshot only. They are not a diagnosis. */
const MATRICES = {
  protanopia: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  deuteranopia: '0.625 0.375 0 0 0  0.700 0.300 0 0 0  0 0.300 0.700 0 0  0 0 0 1 0',
  tritanopia: '0.950 0.050 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
};

const VIEWS = [
  { id: 'none', label: 'Original colors' },
  { id: 'protanopia', label: 'Protanopia' },
  { id: 'deuteranopia', label: 'Deuteranopia' },
  { id: 'tritanopia', label: 'Tritanopia' },
];

/**
 * @param {{ marks: { violationId: string, name: string, role: string, n: number | null }[],
 *   onFilter: (filter: string | null) => void }} props
 */
export function Simulators({ marks, onFilter, keyboard = [] }) {
  const [view, setView] = useState('none');
  const filterId = useId().replace(/:/g, '');
  const filter = view === 'none' ? null : `url(#${filterId}-${view})`;

  useEffect(() => {
    onFilter(filter);
  }, [filter, onFilter]);

  return (
    <div className="mt-3">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        {Object.entries(MATRICES).map(([id, values]) => (
          <filter key={id} id={`${filterId}-${id}`}>
            <feColorMatrix type="matrix" values={values} />
          </filter>
        ))}
      </svg>
      <div role="group" aria-label="Approximate color view" className="flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={view === item.id}
            className={`min-h-10 rounded-md border px-2 text-sm ${
              view === item.id ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
            }`}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Approximate color view of this screenshot. Not a diagnosis, and not a second scan.
      </p>
      <h3 className="mt-4 text-sm font-semibold">Names a screen reader can use</h3>
      {marks.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No elements were measured on this screenshot.</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {marks.map((mark) => (
            <li key={mark.violationId}>
              {mark.n ? `Issue ${mark.n}. ` : ''}
              {mark.role || 'element'}: {mark.name || '(no accessible name)'}
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-4 text-sm font-semibold">Keyboard</h3>
      {keyboard.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Focus order was not captured. This phase does not press Tab.
        </p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {keyboard.map((check) => (
            <li key={`${check.url ?? ''}-${check.id}`}>
              {check.message} <span className="text-muted-foreground">({check.confidence} confidence)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
