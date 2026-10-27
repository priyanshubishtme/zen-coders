import { lazy, Suspense, useMemo, useState } from 'react';
import { screenshotUrl } from '@/lib/api.js';
import { buildPreviewModel, MARK_GLYPH, oneLine } from '@/lib/markLayout.js';
import { severityOf } from '@/lib/severity.js';
import { MarkLegend, Marks } from './Marks.jsx';

const CodePane = lazy(() => import('./CodePane.jsx').then((mod) => ({ default: mod.CodePane })));

/**
 * Screenshot, boxes, and the before/after comparison.
 * @param {{ scan: import('@/lib/api.js').Scan,
 *   highlightIds?: string[], onSelect: (id: string) => void, filter?: string | null }} props
 */
export function Workbench({ scan, highlightIds = [], onSelect, filter = null }) {
  const [layout, setLayout] = useState('side');
  const [split, setSplit] = useState(50);
  const [broken, setBroken] = useState({ before: false, after: false });
  const [showMarks, setShowMarks] = useState(true);

  const model = useMemo(
    () => buildPreviewModel(scan.violations ?? [], scan.manualReview ?? [], scan.marks ?? []),
    [scan],
  );

  const beforeSrc = screenshotUrl(scan.id, 'before');
  const afterSrc = screenshotUrl(scan.id, 'after');
  const showBefore = Boolean(scan.shots?.before) && !broken.before;
  const hasAfter = Boolean(scan.shots?.after) && !broken.after;

  return (
    <section id="preview" aria-labelledby="workbench-heading" className="rounded-xl border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="workbench-heading" className="text-lg font-semibold">
          Page preview
        </h2>
        <div role="group" aria-label="Compare before and after" className="flex rounded-md border bg-background p-0.5">
          {[
            ['side', 'Side by side'],
            ['slider', 'Slider'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={layout === id}
              disabled={!hasAfter && id === 'slider'}
              className={`min-h-9 rounded-[5px] px-3 text-sm disabled:opacity-50 ${
                layout === id ? 'bg-raised font-semibold text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setLayout(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <WholePage chips={model.chips} highlightIds={highlightIds} onSelect={onSelect} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="min-h-10 rounded-md border bg-background px-3 text-sm hover:bg-raised"
          aria-pressed={showMarks}
          onClick={() => setShowMarks((value) => !value)}
        >
          {showMarks ? 'Hide marks' : 'Show marks'}
        </button>
      </div>
      <MarkLegend />

      {!showBefore ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No screenshot for this scan. The issue list below still works.
        </p>
      ) : layout === 'slider' && hasAfter ? (
        <div className="relative mt-3 aspect-video rounded-md border bg-surface">
          <img
            src={beforeSrc}
            alt="Page before fixes"
            className="absolute inset-0 h-full w-full object-contain"
            style={filter ? { filter } : undefined}
            onError={() => setBroken((m) => ({ ...m, before: true }))}
          />
          <img
            src={afterSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)`, ...(filter ? { filter } : {}) }}
          />
          <Marks items={model.boxes} highlightIds={highlightIds} onSelect={onSelect} hidden={!showMarks} />
        </div>
      ) : (
        <div className={`mt-3 grid gap-3 ${layout === 'side' && hasAfter ? 'md:grid-cols-2' : ''}`}>
          <Shot
            src={beforeSrc}
            alt="Page before fixes"
            filter={filter}
            items={model.boxes}
            highlightIds={highlightIds}
            onSelect={onSelect}
            hidden={!showMarks}
            onError={() => setBroken((m) => ({ ...m, before: true }))}
          />
          {hasAfter && (
            <Shot
              src={afterSrc}
              alt="Page after verified fixes"
              filter={filter}
              onError={() => setBroken((m) => ({ ...m, after: true }))}
            />
          )}
        </div>
      )}

      {layout === 'slider' && hasAfter && (
        <label className="mt-3 block text-sm">
          Compare before and after
          <input
            type="range"
            min="0"
            max="100"
            value={split}
            aria-valuetext={`${split}% after`}
            className="mt-1 block w-full"
            onChange={(event) => setSplit(Number(event.target.value))}
          />
        </label>
      )}
      {!hasAfter && showBefore && (
        <p className="mt-2 max-w-[65ch] text-sm text-muted-foreground">
          The after image appears once verified fixes are applied.
        </p>
      )}
    </section>
  );
}

function WholePage({ chips, highlightIds, onSelect }) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold">Whole page</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const severity = chip.manual ? 'check by hand' : severityOf(chip.violation.impact).label.toLowerCase();
          const glyph = chip.manual ? MARK_GLYPH.manual : MARK_GLYPH[chip.violation.impact] ?? MARK_GLYPH.moderate;
          const reason = chip.manual ? oneLine(chip.violation.explanation) : oneLine(chip.violation.title);
          const active = highlightIds.includes(chip.violation.id);
          return (
            <li key={chip.violation.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                aria-label={`Issue ${chip.n}, ${severity}: ${chip.manual ? `Check by hand. ${reason}` : reason}`}
                className={`inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border px-2 text-left text-sm ${
                  chip.manual ? 'border-dashed' : ''
                } ${active ? 'ring-2 ring-foreground' : ''}`}
                onClick={() => onSelect(chip.violation.id)}
              >
                <span className="font-semibold tabular-nums" aria-hidden="true">
                  {glyph}
                  {chip.n}
                </span>
                <span className="truncate">{chip.manual ? `Check by hand. ${reason}` : reason}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Shot({ src, alt, filter, items = [], highlightIds = [], onSelect = () => {}, hidden = false, onError }) {
  return (
    <div className="relative aspect-video rounded-md border bg-surface">
      <img src={src} alt={alt} className="h-full w-full object-contain" style={filter ? { filter } : undefined} onError={onError} />
      <Marks items={items} highlightIds={highlightIds} onSelect={onSelect} hidden={hidden} />
    </div>
  );
}

/** Code stays collapsed until the reader asks for it. Monaco loads on that click. */
export function CodeDisclosure({ scanId, patchedHtml }) {
  const [showCode, setShowCode] = useState(false);
  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="text-sm font-semibold">Original and patched, side by side</h3>
      <p className="mt-1 text-sm text-muted-foreground">The code editor loads only when you open it.</p>
      <button
        type="button"
        className="mt-3 min-h-10 rounded-md border px-3 text-sm hover:bg-raised"
        aria-expanded={showCode}
        onClick={() => setShowCode(true)}
      >
        Show original and patched code
      </button>
      {showCode && (
        <Suspense fallback={<p className="mt-3 text-sm">Loading the editor…</p>}>
          <CodePane scanId={scanId} patchedHtml={patchedHtml ?? null} />
        </Suspense>
      )}
    </div>
  );
}
