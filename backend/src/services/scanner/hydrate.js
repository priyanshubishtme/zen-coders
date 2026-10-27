/**
 * Wait until the DOM has been quiet for `quietMs`, but never longer than `capMs`.
 * A chatty page resolves at the cap so the scan still finishes.
 * @param {import('playwright').Page} page
 * @param {number} quietMs
 * @param {number} capMs
 * @returns {Promise<boolean>} true when a quiet window was seen
 */
export function waitForQuiet(page, quietMs, capMs) {
  return page.evaluate(
    ({ quiet, cap }) =>
      new Promise((resolve) => {
        const root = globalThis.document;
        const start = Date.now();
        let settled = false;
        const obs = new MutationObserver(() => {
          clearTimeout(timer);
          if (Date.now() - start >= cap) done(false);
          else timer = setTimeout(() => done(true), quiet);
        });
        let timer = setTimeout(() => done(true), quiet);
        function done(quietSeen) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          obs.disconnect();
          resolve(quietSeen);
        }
        obs.observe(root.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        setTimeout(() => done(false), cap);
      }),
    { quiet: quietMs, cap: capMs },
  );
}
