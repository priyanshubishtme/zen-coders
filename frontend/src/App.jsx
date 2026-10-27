import { ServerCrash } from 'lucide-react';
import { ErrorPanel } from '@/components/ErrorPanel.jsx';
import { ScanForm } from '@/components/ScanForm.jsx';
import { ScanProgress } from '@/components/ScanProgress.jsx';
import { Results } from '@/components/results/Results.jsx';
import { Alert } from '@/components/ui/alert.jsx';
import { Shell } from '@/components/layout/Shell.jsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.jsx';
import { useHealth } from '@/hooks/useHealth.js';
import { useScan } from '@/hooks/useScan.js';
import { usePath } from '@/lib/path.js';
import { Business } from '@/pages/Business.jsx';
import { History } from '@/pages/History.jsx';
import { LandingIntro } from '@/pages/LandingIntro.jsx';
import { Login } from '@/pages/Login.jsx';
import { Projects } from '@/pages/Projects.jsx';
import { ReportPage } from '@/pages/ReportPage.jsx';

function disabledReason(healthState) {
  if (healthState === 'down')
    return 'The AccessFix API is not reachable. Start it with `npm run dev`.';
  if (healthState === 'degraded') {
    return 'The scanner browser is offline. Install it with `npm run browsers:install`, then restart the API.';
  }
  return null;
}

function Workspace({ health, healthState, pollMs }) {
  const scan = useScan({ pollMs });
  const busy = scan.phase === 'submitting' || scan.phase === 'polling';
  const blocked = disabledReason(healthState);
  return (
    <>
      <LandingIntro />
      <h2 className="mt-10 text-lg font-semibold">Try it on a page</h2>
      <div className="mt-4 space-y-6">
        {blocked && healthState !== 'checking' && (
          <Alert tone="warning" icon={ServerCrash} title="Scanning is unavailable" role="status">
            {blocked}
          </Alert>
        )}
        <ScanForm
          onSubmit={scan.start}
          busy={busy}
          disabledReason={blocked}
          maxBytes={health?.limits.maxHtmlBytes}
        />
        {busy && scan.scan?.pages?.length > 0 && (
          <ul className="rounded-lg border px-3 py-2 text-sm" aria-label="Crawl progress">
            {scan.scan.pages.map((page) => (
              <li key={`${page.depth}-${page.url}`} className="flex justify-between gap-3 py-1">
                <span className="font-mono">{page.url}</span>
                <span>{page.status === 'completed' ? 'Finished' : page.reason}</span>
              </li>
            ))}
          </ul>
        )}
        {busy && <ScanProgress stage={scan.scan?.stage ?? 'submitting'} onCancel={scan.cancel} />}
        {scan.phase === 'error' && <ErrorPanel error={scan.error} onRetry={scan.cancel} />}
        {scan.phase === 'done' && scan.scan.status === 'failed' && (
          <ErrorPanel error={scan.scan.error} onRetry={scan.cancel} />
        )}
        {scan.phase === 'done' && scan.scan.status === 'completed' && (
          <Results scan={scan.scan} health={health} />
        )}
      </div>
    </>
  );
}

function Router({ path, ...rest }) {
  const report = /^\/scans\/([^/]+)\/report$/.exec(path);
  if (report) return <ReportPage id={decodeURIComponent(report[1])} />;
  const share = /^\/shares\/([^/]+)$/.exec(path);
  if (share) return <ReportPage shareToken={decodeURIComponent(share[1])} />;
  if (path === '/history') return <History />;
  if (path === '/business') return <Business health={rest.health} />;
  if (path === '/login' || path === '/signup') return <Login mode={path === '/signup' ? 'signup' : 'login'} />;
  if (path === '/projects') return <Projects />;
  return <Workspace {...rest} />;
}

/** @param {{ pollMs?: number }} props */
export default function App({ pollMs } = {}) {
  const { state: healthState, health } = useHealth();
  const path = usePath();
  return (
    <ErrorBoundary>
      <Shell healthState={healthState} health={health} path={path}>
        <Router path={path} health={health} healthState={healthState} pollMs={pollMs} />
      </Shell>
    </ErrorBoundary>
  );
}
