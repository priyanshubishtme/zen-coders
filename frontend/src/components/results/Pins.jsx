/**
 * Numbered pins. Positions are fractions of the screenshot, so they stay put when it scales.
 * @param {{ marks: { violationId: string, n: number, x: number, y: number }[],
 *   titles: Record<string, string>, activeId: string | null, onSelect: (id: string) => void }} props
 */
export function Pins({ marks, titles, activeId, onSelect }) {
  return (
    <>
      {marks.map((mark) => (
        <button
          key={mark.violationId}
          type="button"
          className={`absolute z-10 flex min-h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground ${
            activeId === mark.violationId ? 'ring-2 ring-foreground' : ''
          }`}
          style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
          aria-label={`Issue ${mark.n}: ${titles[mark.violationId] ?? 'issue'}`}
          aria-current={activeId === mark.violationId ? 'true' : undefined}
          onClick={() => onSelect(mark.violationId)}
        >
          <span aria-hidden="true">{mark.n}</span>
        </button>
      ))}
    </>
  );
}
