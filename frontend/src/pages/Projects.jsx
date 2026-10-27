import { useEffect, useState } from 'react';
import { getMe, getScan } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { formatScore } from '@/lib/score.js';

export function Projects() {
  const [me, setMe] = useState(null);
  const [scans, setScans] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getMe()
      .then(async (user) => {
        if (!active) return;
        setMe(user);
        const rows = [];
        for (const id of user.scanIds ?? []) {
          try {
            rows.push(await getScan(id));
          } catch {
            /* a deleted scan drops out of the list */
          }
        }
        if (active) setScans(rows);
      })
      .catch((err) => active && setError(err));
    return () => {
      active = false;
    };
  }, []);

  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') {
    return (
      <article>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="mt-2">
          <Link href="/login" className="text-primary underline">
            Sign in
          </Link>{' '}
          to see your project and the scans you started while signed in.
        </p>
      </article>
    );
  }
  if (error) return <p role="alert">{error.message}</p>;
  if (!me) return <p>Loading account…</p>;

  return (
    <article>
      <h1 className="text-2xl font-semibold">Projects</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {me.email} · {me.plan === 'pro' ? 'Pro' : 'Free. Daily limits apply only when the server has quotas turned on.'}
      </p>
      <ul className="mt-4 space-y-2">
        {(me.projects ?? []).map((project) => (
          <li key={project.id} className="rounded-lg border px-3 py-2">
            <h2 className="text-sm font-semibold">{project.name}</h2>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-semibold">Scans</h2>
      {scans.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No scans yet.</p>
      ) : (
        <ul className="mt-2 divide-y rounded-lg border">
          {scans.map((scan) => (
            <li key={scan.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <Link href={`/scans/${scan.id}/report`} className="font-mono text-primary underline">
                {scan.page?.finalUrl ?? scan.id}
              </Link>
              <span>
                {scan.partial ? 'Partial · ' : ''}
                Score {formatScore(scan.score?.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
