import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { screenshotUrl } from '@/lib/api.js';
import { LogPanel } from './LogPanel.jsx';
import { Pins } from './Pins.jsx';
import { Simulators } from './Simulators.jsx';

const CodePane = lazy(() => import('./CodePane.jsx').then((mod) => ({ default: mod.CodePane })));

function prefersStill() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Screenshot, pins, before/after, log, and simulators for one finished scan.
 * @param {{ scan: import('@/lib/api.js').Scan,
 *   verification: { patchedHtml?: string } | null,
 *   activeId: string | null, onSelect: (id: string) => void }} props
 */
export function Workbench({ scan, verification, activeId, onSelect }) {
  const still = prefersStill();
  const [layout, setLayout] = useState(still ? 'side' : 'side');
  const [split, setSplit] = useState(50);
  const [broken, setBroken] = useState({ before: false, after: false });
  const [showCode, setShowCode] = useState(false);
  const [filter, setFilter] = useState(null);
  const [afterLive, setAfterLive] = useState(false);
  const onFilter = useCallback((next) => setFilter(next), []);
  const onLog = useCallback((event) => {
    if (event.stage === 'screenshot' && event.message.startsWith('After screenshot captured')) {
      setAfterLive(true);
    }
  }, []);

  const titles = useMemo(() => {
    const map = {};
    for (const item of [...(scan.violations ?? []), ...(scan.advisory ?? []), ...(scan.manualReview ?? [])]) {
      map[item.id] = item.title;
    }
    return map;
  }, [scan]);

  const pins = (scan.marks ?? []).filter((mark) => mark.place === 'pin' && mark.n != null);
  const beforeSrc = screenshotUrl(scan.id, 'before');
  const afterSrc = screenshotUrl(scan.id, 'after');
  const afterFromLog = (scan.events ?? []).some(
    (event) => event.stage === 'screenshot' && event.message.startsWith('After screenshot captured'),
  );
  const showBefore = Boolean(scan.shots?.before) && !broken.before;
  const hasAfter = (Boolean(scan.shots?.after) || afterLive || afterFromLog) && !broken.after;

  function focusIssue(id) {
    onSelect(id);
    const row = document.getElementById(`issue-${id}`);
    row?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    row?.focus();
  }

  return (
    <section aria-labelledby="workbench-heading" className="mt-6 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="workbench-heading" className="text-lg font-semibold">
          Page preview
        </h2>
        <div role="group" aria-label="Preview layout" className="flex rounded-md border">
          {[
            ['side', 'Side by side'],
            ['slider', 'Slider'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={layout === id}
              className={`min-h-10 px-3 text-sm ${
                layout === id ? 'bg-primary text-primary-foreground' : 'text-foreground'
              }`}
              onClick={() => setLayout(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!showBefore ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No screenshot for this scan. The issue list below still works.
        </p>
      ) : layout === 'slider' && hasAfter ? (
        <div className="relative mt-3 aspect-video overflow-hidden rounded-md border bg-surface">
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
            style={{
              clipPath: `inset(0 ${100 - split}% 0 0)`,
              ...(filter ? { filter } : {}),
            }}
          />
          <Pins marks={pins} titles={titles} activeId={activeId} onSelect={focusIssue} />
        </div>
      ) : (
        <div className={`mt-3 grid gap-3 ${layout === 'side' && hasAfter ? 'md:grid-cols-2' : ''}`}>
          <Shot
            src={beforeSrc}
            alt="Page before fixes"
            filter={filter}
            pins={pins}
            titles={titles}
            activeId={activeId}
            onSelect={focusIssue}
            onError={() => setBroken((m) => ({ ...m, before: true }))}
          />
          {hasAfter && (
            <Shot src={afterSrc} alt="Page after verified fixes" filter={filter} onError={() => setBroken((m) => ({ ...m, after: true }))} />
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
        <p className="mt-2 text-sm text-muted-foreground">
          The after image appears once verified fixes are applied.
        </p>
      )}

      <Simulators marks={scan.marks ?? []} keyboard={scan.keyboard ?? []} onFilter={onFilter} />
      <LogPanel key={scan.id} scanId={scan.id} saved={scan.events ?? []} onEvent={onLog} />

      <div className="mt-4">
        <button
          type="button"
          className="min-h-10 rounded-md border px-3 text-sm"
          aria-expanded={showCode}
          onClick={() => setShowCode(true)}
        >
          Show original and patched code
        </button>
        {showCode && (
          <Suspense fallback={<p className="mt-3 text-sm">Loading the editor…</p>}>
            <CodePane scanId={scan.id} patchedHtml={verification?.patchedHtml ?? null} />
          </Suspense>
        )}
      </div>
    </section>
  );
}

function Shot({ src, alt, filter, pins = [], titles = {}, activeId = null, onSelect = () => {}, onError }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-md border bg-surface">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        style={filter ? { filter } : undefined}
        onError={onError}
      />
      <Pins marks={pins} titles={titles} activeId={activeId} onSelect={onSelect} />
    </div>
  );
}
