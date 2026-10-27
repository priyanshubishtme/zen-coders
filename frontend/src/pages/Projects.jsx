import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { getMe, listScans } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { formatScore } from '@/lib/score.js';

const fmt = (n) => new Intl.NumberFormat().format(n);
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function label(scan) {
  if (scan.input?.type === 'url') return scan.page?.finalUrl ?? scan.input.url;
  return scan.page?.title ? `${scan.page.title} (pasted HTML)` : 'Pasted HTML';
}

export function Projects({ health }) {
  const [me, setMe] = useState(null);
  const [scans, setScans] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getMe()
      .then(async (user) => {
        if (!active) return;
        setMe(user);
        const ids = user.scanIds ?? [];
        const body = ids.length ? await listScans(ids.slice(0, 50)) : { scans: [] };
        if (active) setScans(body.scans ?? []);
      })
      .catch((err) => active && setError(err));
    return () => {
      active = false;
    };
  }, []);

  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') {
    return (
      <article className="mx-auto max-w-xl rounded-xl border bg-surface p-8 text-center">
        <FolderOpen aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-semibold">Projects</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in to keep your scans in one place, crawl whole sites, and create share links. Pasting one page still
          works without an account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline"
          >
            Sign in
          </Link>
          <Link href="/signup" className="inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium no-underline">
            Create an account
          </Link>
        </div>
      </article>
    );
  }
  if (error) return <p role="alert">{error.message}</p>;
  if (!me) return <p role="status">Loading account…</p>;

  const plan = me.plan === 'pro' ? 'pro' : 'free';
  const limits = health?.plans?.[plan];
  const quotasOn = health?.quotas === 'on';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.email} · {plan === 'pro' ? 'Pro' : 'Free'} plan
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-labelledby="scans-heading" className="rounded-xl border bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
            <h2 id="scans-heading" className="text-lg font-semibold">
              Scans
            </h2>
            <p className="text-sm text-muted-foreground">
              {(me.projects ?? []).map((p) => p.name).join(', ') || 'Default project'} ·{' '}
              <span className="tabular">{scans?.length ?? 0}</span> kept
            </p>
          </div>
          {scans === null ? (
            <p className="px-5 py-6 text-sm text-muted-foreground" role="status">
              Loading scans…
            </p>
          ) : scans.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">No scans yet. Scans you start while signed in appear here.</p>
              <Link
                href="/"
                className="mt-4 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline"
              >
                Start a scan
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {scans.map((scan) => (
                <li key={scan.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/scans/${scan.id}/report`} className="block truncate font-medium text-link underline">
                      {label(scan)}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {when(scan.completedAt ?? scan.createdAt)}
                      {scan.pages?.length ? ` · crawl of ${scan.pages.length} pages` : ''}
                      {scan.partial ? ' · partial' : ''}
                    </p>
                  </div>
                  <p className="text-right text-sm">
                    <span className="tabular block text-lg font-semibold">{formatScore(scan.score?.value)}</span>
                    <span className="text-muted-foreground">{(scan.violations ?? []).length} failing elements</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="plan-heading" className="rounded-xl border bg-surface p-5">
          <h2 id="plan-heading" className="text-base font-semibold">
            Your plan: {plan === 'pro' ? 'Pro' : 'Free'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {quotasOn
              ? 'Daily limits reset at midnight UTC.'
              : 'Quotas are off on this server, so these limits are shown but not enforced.'}
          </p>
          {limits && (
            <dl className="mt-4 divide-y rounded-lg border bg-background text-sm">
              {[
                ['Scans per day', limits.scansDay],
                ['Pages per day', limits.pagesDay],
                ['AI tokens per day', limits.tokensDay],
                ['Pages per crawl', limits.crawlPages],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="tabular font-medium">{fmt(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-sm">
            <Link href="/business" className="text-link underline">
              Compare plans and limits
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
