import { ServerCrash } from 'lucide-react';
import { ErrorPanel } from '@/components/ErrorPanel.jsx';
import { ScanForm } from '@/components/ScanForm.jsx';
import { ScanProgress } from '@/components/ScanProgress.jsx';
import { Results } from '@/components/results/Results.jsx';
import { CrawlPages } from '@/components/results/CrawlPages.jsx';
import { Alert } from '@/components/ui/alert.jsx';
import { Shell } from '@/components/layout/Shell.jsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.jsx';
import { useHealth } from '@/hooks/useHealth.js';
import { useScan } from '@/hooks/useScan.js';
import { usePath } from '@/lib/path.js';
import { Business } from '@/pages/Business.jsx';
import { History } from '@/pages/History.jsx';
import { LandingIntro, LandingProof } from '@/pages/LandingIntro.jsx';
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
  const done = scan.phase === 'done' && scan.scan?.status === 'completed';
  return (
    <div className="space-y-8">
      {!done && <LandingIntro />}
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
        crawl={health?.crawl}
      />
      {busy && scan.scan?.pages?.length > 0 && (
        <CrawlPages scan={scan.scan} live zipMaxBytes={health?.crawl?.zipMaxBytes} />
      )}
      {busy && <ScanProgress stage={scan.scan?.stage ?? 'submitting'} onCancel={scan.cancel} />}
      {scan.phase === 'error' && <ErrorPanel error={scan.error} onRetry={scan.cancel} />}
      {scan.phase === 'done' && scan.scan.status === 'failed' && (
        <ErrorPanel error={scan.scan.error} onRetry={scan.cancel} />
      )}
      {done && <Results scan={scan.scan} health={health} />}
      {!done && <LandingProof />}
    </div>
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
  if (path === '/projects') return <Projects health={rest.health} />;
  return <Workspace {...rest} />;
}

/** @param {{ pollMs?: number }} props */
export default function App({ pollMs } = {}) {
  const { state: healthState, health } = useHealth();
  const path = usePath();
  const bare = path === '/login' || path === '/signup';
  return (
    <ErrorBoundary>
      <Shell healthState={healthState} health={health} path={path} bare={bare}>
        <Router path={path} health={health} healthState={healthState} pollMs={pollMs} />
      </Shell>
    </ErrorBoundary>
  );
}
