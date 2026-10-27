/**
 * Scanner strategies. Only `singlePage` is implemented. The rest are extension
 * points documented in docs/09-roadmap-future.md — do not call them.
 */
export const SCANNER_STRATEGIES = Object.freeze({
  singlePage: { status: 'live', notes: 'Paste HTML or one URL. Network idle, then axe.' },
  crawler: {
    status: 'stub',
    plugIn: 'services/crawler producing a same-origin URL list into the orchestrator',
    contract: 'additive /sites endpoints',
  },
  spaHydration: {
    status: 'stub',
    plugIn: 'ready strategy: load → network idle → mutation quiet → optional waitFor',
    contract: 'ScanOptions.waitFor',
  },
  authCookie: {
    status: 'stub',
    plugIn: 'per-scan Playwright storageState, never logged, short TTL',
    contract: 'ScanOptions.auth',
  },
  keyboardFocus: {
    status: 'stub',
    plugIn: 'scanner/checks/focus-*.js driving Tab and recording traps / missing outlines',
    contract: 'new accessfix rule ids mapped to 2.1.1 / 2.1.2 / 2.4.3 / 2.4.7 / 2.4.11',
  },
});
