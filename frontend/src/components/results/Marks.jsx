import { useEffect, useRef, useState } from 'react';
import { MARK_FILLS, MARK_FRAME, MARK_GLYPH, oneLine, placeBadges } from '@/lib/markLayout.js';
import { severityOf } from '@/lib/severity.js';

/**
 * Boxes and numbered badges over the screenshot. Positions are fractions of the viewport.
 * @param {{ items: { violation: import('@/lib/api.js').Violation, mark: { x: number, y: number, w: number, h: number }, n: number, manual?: boolean }[],
 *   highlightIds?: string[], onSelect: (id: string) => void, hidden?: boolean }} props
 */
export function Marks({ items, highlightIds = [], onSelect, hidden = false }) {
  const frameRef = useRef(null);
  const [displayScale, setDisplayScale] = useState(1);
  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver !== 'function') return undefined;
    const update = () => {
      const width = node.clientWidth;
      setDisplayScale(width >= 80 ? width / MARK_FRAME.width : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hidden, items.length]);
  if (hidden || items.length === 0) return null;
  const placed = placeBadges(
    items.map((item) => ({
      id: item.violation.id,
      x: item.mark.x,
      y: item.mark.y,
      w: item.mark.w,
      h: item.mark.h,
    })),
    MARK_FRAME,
    displayScale,
  );
  const byId = new Map(placed.map((item) => [item.id, item]));

  return (
    <div ref={frameRef} className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${MARK_FRAME.width} ${MARK_FRAME.height}`} aria-hidden="true">
        {items.map((item) => {
          const spot = byId.get(item.violation.id);
          if (!spot?.leader) return null;
          const fill = item.manual ? MARK_FILLS.manual : MARK_FILLS[item.violation.impact] ?? MARK_FILLS.moderate;
          const end = nearestPoint(spot.box, spot.badge);
          return (
            <line
              key={`line-${item.violation.id}`}
              x1={spot.badge.x + spot.badge.w / 2}
              y1={spot.badge.y + spot.badge.h / 2}
              x2={end.x}
              y2={end.y}
              stroke={fill}
              strokeWidth="2"
            />
          );
        })}
      </svg>
      {items.map((item) => {
        const spot = byId.get(item.violation.id);
        if (!spot) return null;
        const fill = item.manual ? MARK_FILLS.manual : MARK_FILLS[item.violation.impact] ?? MARK_FILLS.moderate;
        const active = highlightIds.includes(item.violation.id);
        return (
          <div
            key={item.violation.id}
            className="absolute"
            style={{
              left: `${(spot.box.x / MARK_FRAME.width) * 100}%`,
              top: `${(spot.box.y / MARK_FRAME.height) * 100}%`,
              width: `${(spot.box.w / MARK_FRAME.width) * 100}%`,
              height: `${(spot.box.h / MARK_FRAME.height) * 100}%`,
              outline: `${active ? 3 : 2}px ${item.manual ? 'dashed' : 'solid'} ${fill}`,
              outlineOffset: '1px',
              boxShadow: '0 0 0 1px #ffffff, 0 0 0 2px #0f172a',
            }}
          />
        );
      })}
      {items.map((item) => {
        const spot = byId.get(item.violation.id);
        if (!spot) return null;
        const fill = item.manual ? MARK_FILLS.manual : MARK_FILLS[item.violation.impact] ?? MARK_FILLS.moderate;
        const glyph = item.manual ? MARK_GLYPH.manual : MARK_GLYPH[item.violation.impact] ?? MARK_GLYPH.moderate;
        const active = highlightIds.includes(item.violation.id);
        const severity = item.manual ? 'check by hand' : severityOf(item.violation.impact).label.toLowerCase();
        const broken = oneLine(item.manual ? `Check by hand. ${item.violation.explanation}` : item.violation.title);
        const label = `Issue ${item.n}, ${severity}: ${broken}`;
        return (
          <button
            key={`badge-${item.violation.id}`}
            type="button"
            className="group pointer-events-auto absolute z-10 flex items-center justify-center font-semibold text-white"
            style={{
              left: `${(spot.badge.x / MARK_FRAME.width) * 100}%`,
              top: `${(spot.badge.y / MARK_FRAME.height) * 100}%`,
              width: spot.badge.w * displayScale,
              height: spot.badge.h * displayScale,
              background: fill,
              borderRadius: item.violation.impact === 'minor' && !item.manual ? '999px' : item.violation.impact === 'critical' ? '2px' : '4px',
              boxShadow: '0 0 0 2px #ffffff, 0 0 0 3px #0f172a',
              lineHeight: 1,
              fontSize: spot.badge.w * displayScale < 20 ? 10 : 12,
            }}
            aria-label={label}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(item.violation.id)}
          >
            <span aria-hidden="true">
              {spot.size < 20 ? item.n : `${glyph}${item.n}`}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-56 -translate-x-1/2 rounded-md border border-white bg-background px-2 py-1 text-left text-sm font-normal text-foreground shadow-[0_0_0_1px_#0f172a] group-hover:block group-focus-visible:block"
            >
              {broken}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function nearestPoint(box, badge) {
  const cx = badge.x + badge.w / 2;
  const cy = badge.y + badge.h / 2;
  return {
    x: Math.min(Math.max(cx, box.x), box.x + box.w),
    y: Math.min(Math.max(cy, box.y), box.y + box.h),
  };
}

export function MarkLegend() {
  const items = [
    ['critical', 'Critical', MARK_GLYPH.critical],
    ['serious', 'Serious', MARK_GLYPH.serious],
    ['moderate', 'Moderate', MARK_GLYPH.moderate],
    ['minor', 'Minor', MARK_GLYPH.minor],
    ['manual', 'Check by hand', MARK_GLYPH.manual],
  ];
  return (
    <ul aria-label="Mark legend" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {items.map(([key, label, glyph]) => (
        <li key={key} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-flex size-4 items-center justify-center text-[10px] text-white"
            style={{
              background: MARK_FILLS[key],
              boxShadow: '0 0 0 1px #ffffff, 0 0 0 2px #0f172a',
              borderRadius: key === 'minor' ? '999px' : '2px',
            }}
          >
            {glyph}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
