import { useEffect, useState } from 'react';
import { listScans } from '@/lib/api.js';
import { loadHistory } from '@/lib/historyStore.js';
import { Link } from '@/lib/Link.jsx';
import { formatScore } from '@/lib/score.js';
import { ScoreTrend } from './ScoreTrend.jsx';

export function History() {
  const stored = loadHistory();
  const [scans, setScans] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ids = loadHistory().map((e) => e.id);
    if (!ids.length) return;
    listScans(ids)
      .then((body) => setScans(body.scans ?? []))
      .catch((err) => setError(err));
  }, []);

  const points = (scans.length ? scans : stored).map((s) => ({
    id: s.id,
    when: s.createdAt ?? s.when ?? '',
    score: s.score?.value ?? s.score ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Scan history</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Only scans this browser started. IDs live in local storage; the server will not list anyone
        else’s work. Shared report links still work for anyone who has the id, and expire after 30
        days.
      </p>
      {error && (
        <p className="mt-4 text-critical" role="alert">
          {error.message}
        </p>
      )}
      {stored.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No scans yet.{' '}
          <Link href="/" className="text-primary underline">
            Run one
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-lg border bg-surface p-4">
            <ScoreTrend points={points} />
          </div>
          <ul className="mt-6 divide-y">
            {stored.map((e) => {
              const live = scans.find((s) => s.id === e.id);
              const score = live?.score?.value ?? e.score;
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">
                      {live?.page?.title || e.label || 'Scan'} · score {formatScore(score)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{e.id}</p>
                  </div>
                  <Link href={`/scans/${e.id}/report`} className="text-sm text-primary underline">
                    Open report
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
