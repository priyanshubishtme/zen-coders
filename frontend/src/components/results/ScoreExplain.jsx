/**
 * The documented formula with this scan's numbers, plus every scored rule.
 * @param {{ score: import('@/lib/api.js').Score }} props
 */
export function ScoreExplain({ score }) {
  const { weightedFailures: f, weightedTotal: t, value } = score;
  const inner = t === 0 ? 'nothing applied' : `round(100 × (1 − ${f} / ${t}))`;
  return (
    <details className="mt-3">
      <summary className="min-h-6 cursor-pointer text-sm font-medium text-link">
        Explain this score
      </summary>
      <div className="mt-2 space-y-3 text-sm">
        <p>
          score = {inner}
          {t > 0 && ` = ${value}`}
        </p>
        {score.rules.length > 0 && (
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Weighted pass and fail counts per rule</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-1 pr-2 font-medium">
                  Rule
                </th>
                <th scope="col" className="py-1 pr-2 font-medium">
                  Weight
                </th>
                <th scope="col" className="py-1 pr-2 font-medium">
                  Pass
                </th>
                <th scope="col" className="py-1 pr-2 font-medium">
                  Fail
                </th>
                <th scope="col" className="py-1 font-medium">
                  w·fail
                </th>
              </tr>
            </thead>
            <tbody>
              {score.rules.map((r) => (
                <tr key={r.ruleId} className="border-b border-border/60">
                  <td className="py-1 pr-2 font-mono">{r.ruleId}</td>
                  <td className="py-1 pr-2">{r.weight}</td>
                  <td className="py-1 pr-2">{r.pass}</td>
                  <td className="py-1 pr-2">{r.fail}</td>
                  <td className="py-1">{r.weight * r.fail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-muted-foreground">
          Manual review ({score.manualReviewCount}) and advisory ({score.advisoryCount}) are kept
          out of the score on purpose.
        </p>
      </div>
    </details>
  );
}
