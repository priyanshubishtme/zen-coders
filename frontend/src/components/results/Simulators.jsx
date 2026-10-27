import { useEffect, useId, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { announcedName, keyboardSentence, problemColors } from '@/lib/markLayout.js';

/** Approximate matrices. These recolor our screenshot only. They are not a diagnosis. */
const MATRICES = {
  protanopia: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  deuteranopia: '0.625 0.375 0 0 0  0.700 0.300 0 0 0  0 0.300 0.700 0 0  0 0 0 1 0',
  tritanopia: '0.950 0.050 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
};

const VIEWS = [
  { id: 'none', label: 'Original colors' },
  { id: 'protanopia', label: 'Red-weak (Protanopia)' },
  { id: 'deuteranopia', label: 'Green-weak (Deuteranopia)' },
  { id: 'tritanopia', label: 'Blue-weak (Tritanopia)' },
];

/**
 * @param {{ onFilter: (filter: string | null) => void,
 *   violations?: { id: string, title: string, node?: { evidence?: { fgColor?: string, bgColor?: string | null } } }[] }} props
 */
export function Simulators({ onFilter, violations = [] }) {
  const [view, setView] = useState('none');
  const filterId = useId().replace(/:/g, '');
  const filter = view === 'none' ? null : `url(#${filterId}-${view})`;
  const colors = problemColors(violations);

  useEffect(() => {
    onFilter(filter);
  }, [filter, onFilter]);

  return (
    <div id="simulators">
      <h3 className="text-sm font-semibold">Color appearance</h3>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        {Object.entries(MATRICES).map(([id, values]) => (
          <filter key={id} id={`${filterId}-${id}`}>
            <feColorMatrix type="matrix" values={values} />
          </filter>
        ))}
      </svg>
      <div role="group" aria-label="Approximate color view" className="mt-2 flex flex-wrap gap-2">
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
      <p className="mt-2 max-w-[65ch] text-sm text-muted-foreground">
        This filter shows how these colors may appear. It is not a second scan.
      </p>
      {colors.length > 0 && (
        <div className="mt-3">
          <h4 className="text-sm font-semibold">Problem colors</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {colors.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <span className="inline-block size-4 border" style={{ background: row.fg }} aria-hidden="true" />
                <span className="font-mono">{row.fg}</span>
                on
                <span className="inline-block size-4 border" style={{ background: row.bg }} aria-hidden="true" />
                <span className="font-mono">{row.bg}</span>
                <span className="text-muted-foreground">{row.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ marks: { violationId: string, name?: string, role?: string, n?: number | null }[],
 *   numberById?: Record<string, number> }} props
 */
export function ScreenReaderTable({ marks, numberById = {} }) {
  return (
    <div id="screen-reader">
      <h3 className="text-sm font-semibold">What a screen reader announces</h3>
      {marks.length === 0 ? (
        <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">No elements were measured on this screenshot.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Accessible names measured on the screenshot</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Number
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Element
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  A screen reader announces
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {marks.map((mark) => (
                <NameRow key={mark.violationId} mark={mark} number={numberById[mark.violationId] ?? mark.n} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NameRow({ mark, number }) {
  const spoken = announcedName(mark);
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-3 tabular-nums">{number ?? '—'}</td>
      <td className="py-2 pr-3">{spoken.element}</td>
      <td className="max-w-[65ch] py-2 pr-3">
        {open && spoken.full ? spoken.full : spoken.text}
        {spoken.truncated && (
          <button type="button" className="ml-2 min-h-10 text-primary underline" onClick={() => setOpen((value) => !value)}>
            {open ? 'Show less' : 'Show more'}
          </button>
        )}
      </td>
      <td className="py-2">
        {spoken.missing ? (
          <span className="inline-flex items-center gap-1 text-serious">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Name missing
          </span>
        ) : (
          'Named'
        )}
      </td>
    </tr>
  );
}

/**
 * @param {{ keyboard?: { id: string, url?: string, message: string, confidence: string }[] }} props
 */
export function KeyboardPanel({ keyboard = [] }) {
  return (
    <div id="keyboard">
      <h3 className="text-sm font-semibold">Keyboard</h3>
      {keyboard.length === 0 ? (
        <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
          Focus order was not captured. This phase does not press Tab.
        </p>
      ) : (
        <ul className="mt-1 max-w-[65ch] list-disc space-y-1 pl-5 text-sm">
          {keyboard.map((check) => (
            <li key={`${check.url ?? ''}-${check.id}`}>
              {keyboardSentence(check.message)}{' '}
              <span className="text-muted-foreground">({check.confidence} confidence)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
