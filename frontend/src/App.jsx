import { ServerCrash, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ApiStatus } from '@/components/ApiStatus.jsx';
import { ErrorPanel } from '@/components/ErrorPanel.jsx';
import { ScanForm } from '@/components/ScanForm.jsx';
import { ScanProgress } from '@/components/ScanProgress.jsx';
import { Results } from '@/components/results/Results.jsx';
import { Alert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useHealth } from '@/hooks/useHealth.js';
import { useScan } from '@/hooks/useScan.js';

function disabledReason(healthState) {
  if (healthState === 'down')
    return 'The AccessFix API is not reachable. Start it with `npm run dev`.';
  if (healthState === 'degraded') {
    return 'The scanner browser is offline. Install it with `npm run browsers:install`, then restart the API.';
  }
  return null;
}

/** @param {{ pollMs?: number }} props */
export default function App({ pollMs } = {}) {
  const { state: healthState, health } = useHealth();
  const scan = useScan({ pollMs });
  const busy = scan.phase === 'submitting' || scan.phase === 'polling';
  const blocked = disabledReason(healthState);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            AccessFix
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {health?.limits.privateUrlsAllowed && (
              <Badge className="border-moderate text-moderate">
                <ShieldAlert aria-hidden="true" className="size-3.5" />
                Private network scanning enabled (dev only)
              </Badge>
            )}
            <ApiStatus state={healthState} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Find accessibility issues</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Paste HTML or enter a URL. AccessFix renders it in an isolated browser, checks it against
          WCAG 2.2 A and AA, and suggests verified source fixes.
        </p>

        <div className="mt-6 space-y-6">
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

          {busy && <ScanProgress stage={scan.scan?.stage ?? 'submitting'} onCancel={scan.cancel} />}

          {scan.phase === 'error' && <ErrorPanel error={scan.error} onRetry={scan.cancel} />}

          {scan.phase === 'done' && scan.scan.status === 'failed' && (
            <ErrorPanel error={scan.scan.error} onRetry={scan.cancel} />
          )}

          {scan.phase === 'done' && scan.scan.status === 'completed' && (
            <Results scan={scan.scan} health={health} />
          )}
        </div>
      </main>
    </>
  );
}
