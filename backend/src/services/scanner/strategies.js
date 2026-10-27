/**
 * Scanner strategies. They compose: the orchestrator picks from the scan options.
 * Keyboard checks are not axe violations and do not change the score.
 */
export const SCANNER_STRATEGIES = Object.freeze({
  singlePage: { status: 'live', notes: 'Paste HTML or one URL. Network idle, DOM quiet, then axe.' },
  crawler: {
    status: 'live',
    plugIn: 'services/crawl breadth-first, one host, robots.txt, time budget',
    contract: 'ScanOptions.crawl. One scan, many pages, streamed as each finishes.',
  },
  spaHydration: {
    status: 'live',
    plugIn: 'load, network idle, DOM quiet, optional CSS selector',
    contract: 'ScanOptions.waitFor. A missing selector is a warning.',
  },
  authCookie: {
    status: 'live',
    plugIn: 'per-scan AES-256-GCM storage state, scan id only on the queue',
    contract: 'CreateScanBody.auth. Deleted after the last attempt.',
  },
  keyboardFocus: {
    status: 'live',
    plugIn: 'scanner/keyboard.js Tab walk, capped',
    contract: 'scan.keyboard checks with confidence. Not axe violations.',
  },
});
