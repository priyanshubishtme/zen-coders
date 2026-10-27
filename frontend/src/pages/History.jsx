import { useEffect, useMemo, useState } from 'react';
import { listScans } from '@/lib/api.js';
import { loadHistory } from '@/lib/historyStore.js';
import { Link } from '@/lib/Link.jsx';
import { ruleText } from '@/lib/rules.js';
import { formatScore } from '@/lib/score.js';
import { ScoreTrend } from './ScoreTrend.jsx';

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function History() {
  const stored = useMemo(() => loadHistory(), []);
  const [scans, setScans] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ids = stored.map((e) => e.id);
    if (!ids.length) return;
    listScans(ids)
      .then((body) => setScans(body.scans ?? []))
      .catch((err) => setError(err));
  }, [stored]);

  const live = new Map(scans.map((s) => [s.id, s]));
  const entries = stored.map((e) => {
    const s = live.get(e.id);
    return {
      id: e.id,
      when: s?.createdAt ?? e.createdAt ?? e.when ?? '',
      score: s?.score?.value ?? e.score ?? null,
      after: e.after ?? null,
      title: s?.page?.title || s?.page?.finalUrl || s?.input?.url || e.label || 'Pasted HTML',
      violations: s?.violations ?? null,
    };
  });
  const chronological = [...entries].reverse();
  const initial = entries.map((e) => e.score).filter((v) => v != null);
  const gains = entries.filter((e) => e.after != null && e.score != null).map((e) => e.after - e.score);
  const latest = entries.find((e) => e.violations);
  const openIssues = latest ? new Set(latest.violations.map((v) => v.ruleId)).size : null;

  const frequent = useMemo(() => {
    const counts = new Map();
    for (const s of scans) {
      for (const ruleId of new Set((s.violations ?? []).map((v) => v.ruleId))) {
        const first = s.violations.find((v) => v.ruleId === ruleId);
        const row = counts.get(ruleId) ?? { ruleId, n: 0, title: ruleText(ruleId, first).title };
        row.n += 1;
        counts.set(ruleId, row);
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.title.localeCompare(b.title)).slice(0, 6);
  }, [scans]);
  const maxN = frequent[0]?.n ?? 1;

  const avgGain = mean(gains);
  const kpis = [
    { label: 'Scans run', value: entries.length, note: 'In this browser' },
    { label: 'Average initial score', value: initial.length ? Math.round(mean(initial)) : '—', note: 'Automated A/AA checks' },
    {
      label: 'Average gain after fixes',
      value: avgGain == null ? '—' : `${avgGain >= 0 ? '+' : ''}${Math.round(avgGain)}`,
      note: gains.length ? `${gains.length} verified ${gains.length === 1 ? 'scan' : 'scans'}` : 'No verified fixes yet',
    },
    { label: 'Open issues', value: openIssues ?? '—', note: 'Rules failing in the latest scan' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scan history</h1>
        <p className="mt-1 max-w-[75ch] text-sm leading-6 text-muted-foreground">
          Only scans this browser started. IDs live in local storage; the server will not list anyone else’s work.
          Shared report links still work for anyone who has the id, and expire after 30 days.
        </p>
      </div>
      {error && (
        <p className="text-critical" role="alert">
          {error.message}
        </p>
      )}
      {entries.length === 0 ? (
        <div className="rounded-xl border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No scans yet.</p>
          <Link
            href="/"
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline"
          >
            Run one
          </Link>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-surface px-5 py-4">
                <dt className="text-sm text-muted-foreground">{k.label}</dt>
                <dd className="tabular mt-1 text-3xl font-semibold tracking-tight">{k.value}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{k.note}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
            <section aria-labelledby="trend-heading" className="rounded-xl border bg-surface p-5">
              <h2 id="trend-heading" className="text-base font-semibold">
                Score trend
              </h2>
              <div className="mt-4">
                <ScoreTrend points={chronological} />
              </div>
            </section>
            <section aria-labelledby="frequent-heading" className="rounded-xl border bg-surface p-5">
              <h2 id="frequent-heading" className="text-base font-semibold">
                Most frequent issues
              </h2>
              {frequent.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No failing rules in the scans still stored.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {frequent.map((row) => (
                    <li key={row.ruleId}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{row.title}</span>
                        <span className="tabular shrink-0 font-semibold">
                          {row.n} {row.n === 1 ? 'scan' : 'scans'}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-raised" aria-hidden="true">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(row.n / maxN) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="list-heading" className="rounded-xl border bg-surface">
            <h2 id="list-heading" className="border-b px-5 py-4 text-base font-semibold">
              All scans
            </h2>
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.when ? new Date(e.when).toLocaleString() : 'Date unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-5">
                    <p className="tabular text-right text-sm">
                      <span className="text-lg font-semibold">{formatScore(e.score)}</span>
                      {e.after != null && <span className="text-verified"> → {e.after}</span>}
                    </p>
                    <Link href={`/scans/${e.id}/report`} className="text-sm font-medium text-link underline">
                      Open report
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
