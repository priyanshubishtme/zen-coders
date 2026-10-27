import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Score over time. Chart plus a data table (charts are not accessible alone).
 * @param {{ points: { id: string, when: string, score: number | null }[] }} props
 */
export function ScoreTrend({ points }) {
  const rows = points.filter((p) => p.score != null);
  if (rows.length < 2) {
    return <p className="text-sm text-muted-foreground">Need at least two scored scans for a trend.</p>;
  }
  const data = rows.map((p, i) => ({
    i: i + 1,
    score: p.score,
    when: p.when.slice(0, 10),
    id: p.id,
  }));
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">Automated score over your last scans</figcaption>
      <div className="h-56 w-full" role="img" aria-labelledby="trend-table-caption">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="when" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="currentColor" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="mt-3 w-full text-sm">
        <caption id="trend-table-caption" className="sr-only">
          The same scores as the chart, as a table
        </caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-1 pr-3">
              Date
            </th>
            <th scope="col" className="py-1">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id} className="border-b">
              <td className="py-1 pr-3">{d.when}</td>
              <td className="py-1">{d.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
