const W = 640;
const H = 220;
const PAD = { left: 36, right: 12, top: 12, bottom: 28 };

/**
 * Score over time: initial score as circles on a solid line, the score after verified
 * fixes as squares on a dashed line. Shape and dash carry the meaning, not color alone.
 * A table with the same numbers follows, because a chart alone is not accessible.
 * @param {{ points: { id: string, when: string, score: number | null, after?: number | null }[] }} props
 */
export function ScoreTrend({ points }) {
  const rows = points.filter((p) => p.score != null);
  if (rows.length < 2) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        Run at least two scans to see a trend. {rows.length === 1 ? 'You have one so far.' : ''}
      </p>
    );
  }
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v) => PAD.top + (1 - v / 100) * innerH;
  const line = (key) =>
    rows
      .map((p, i) => (p[key] == null ? null : `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`))
      .filter(Boolean)
      .join(' ');
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="trend-table-caption">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted-foreground)">
              {t}
            </text>
          </g>
        ))}
        {rows.map((p, i) =>
          i % labelEvery === 0 || i === rows.length - 1 ? (
            <text key={p.id} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
              {p.when.slice(5, 10)}
            </text>
          ) : null,
        )}
        <polyline points={line('score')} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        <polyline points={line('after')} fill="none" stroke="var(--verified)" strokeWidth="2.5" strokeDasharray="7 5" />
        {rows.map((p, i) => (
          <g key={`m-${p.id}`}>
            <circle cx={x(i)} cy={y(p.score)} r="4.5" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />
            {p.after != null && (
              <rect x={x(i) - 4.5} y={y(p.after) - 4.5} width="9" height="9" fill="var(--verified)" stroke="var(--surface)" strokeWidth="2" />
            )}
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="0" x2="22" y1="5" y2="5" stroke="var(--primary)" strokeWidth="2.5" />
            <circle cx="11" cy="5" r="3.5" fill="var(--primary)" />
          </svg>
          Initial score (circles)
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="0" x2="22" y1="5" y2="5" stroke="var(--verified)" strokeWidth="2.5" strokeDasharray="5 3" />
            <rect x="7.5" y="1.5" width="7" height="7" fill="var(--verified)" />
          </svg>
          After verified fixes (squares, dashed)
        </span>
      </figcaption>
      <details className="mt-3">
        <summary className="min-h-10 cursor-pointer content-center text-sm font-medium text-link">Show as a table</summary>
        <table className="mt-2 w-full text-sm">
          <caption id="trend-table-caption" className="sr-only">
            Initial and after-fix scores by scan date
          </caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Date
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Initial
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                After fixes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b last:border-b-0">
                <td className="py-1.5 pr-3">{d.when.slice(0, 10)}</td>
                <td className="tabular py-1.5 pr-3 text-right">{d.score}</td>
                <td className="tabular py-1.5 text-right">{d.after ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
