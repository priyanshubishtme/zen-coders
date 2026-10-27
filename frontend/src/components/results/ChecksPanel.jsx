import { useMemo, useState } from 'react';
import { CircleCheck, CircleX, Hand } from 'lucide-react';
import { buildChecks } from '@/lib/rules.js';

const STATUS = {
  failed: { label: 'Failed', Icon: CircleX, className: 'text-critical' },
  manual: { label: 'Check by hand', Icon: Hand, className: 'text-moderate' },
  passed: { label: 'Passed', Icon: CircleCheck, className: 'text-verified' },
};

const FILTERS = [
  ['all', 'All'],
  ['failed', 'Failed'],
  ['manual', 'Check by hand'],
  ['passed', 'Passed'],
];

/**
 * Every rule that ran on this page, built only from stored scan data.
 * @param {{ scan: import('@/lib/api.js').Scan, onShowIssue?: (violationId: string) => void, headingLevel?: 2 | 3 }} props
 */
export function ChecksPanel({ scan, onShowIssue, headingLevel = 2 }) {
  const rows = useMemo(() => buildChecks(scan), [scan]);
  const [filter, setFilter] = useState('all');
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const H = `h${headingLevel}`;

  return (
    <section id="checks" aria-labelledby="checks-heading" className="rounded-xl border bg-surface p-5 sm:p-6">
      <H id="checks-heading" className="text-lg font-semibold">
        Checks ({rows.length})
      </H>
      <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
        Each automated WCAG rule that applied to this page, with the elements it looked at. Rules with nothing to
        check on this page (for example video captions on a page without video) are not listed. A pass is an
        automated pass, not proof the page works for everyone.
      </p>
      <div role="group" aria-label="Filter checks" className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-10 rounded-md border px-3 text-sm ${
              filter === id ? 'border-foreground bg-raised font-semibold' : 'bg-background hover:bg-raised'
            }`}
          >
            {label} <span className="tabular">({id === 'all' ? rows.length : (counts[id] ?? 0)})</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No rule results were stored for this scan.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <caption className="sr-only">Automated checks and their results</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Check
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  WCAG
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Elements
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Failing
                </th>
                <th scope="col" className="py-2 font-medium">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const s = STATUS[row.status];
                return (
                  <tr key={row.ruleId} className="border-b align-top last:border-b-0">
                    <td className="max-w-[30rem] py-3 pr-3">
                      <span className="block font-medium">{row.title}</span>
                      {row.explanation && (
                        <span className="mt-0.5 block leading-6 text-muted-foreground">{row.explanation}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-muted-foreground">Rule {row.ruleId}</span>
                    </td>
                    <td className="py-3 pr-3">
                      {row.refs.length === 0 ? (
                        '—'
                      ) : (
                        <ul className="space-y-1">
                          {row.refs.map((ref) => (
                            <li key={ref.sc}>
                              <a href={ref.url} target="_blank" rel="noreferrer" className="text-link underline">
                                {ref.sc} {ref.name}
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                              {ref.level ? <span className="text-muted-foreground"> · {ref.level}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="tabular py-3 pr-3 text-right">{row.checked}</td>
                    <td className="tabular py-3 pr-3 text-right">{row.status === 'manual' ? '—' : row.failing}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium ${s.className}`}>
                        <s.Icon aria-hidden="true" className="size-4" />
                        {s.label}
                      </span>
                      {row.violationId && onShowIssue && row.status !== 'passed' && (
                        <button
                          type="button"
                          className="mt-1 block min-h-8 text-link underline"
                          onClick={() => onShowIssue(row.violationId)}
                        >
                          Show issue<span className="sr-only">: {row.title}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
