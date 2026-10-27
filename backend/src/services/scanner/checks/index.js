import { afxHelpers, resolveTargets } from './domHelpers.js';
import { ambiguousLinkText } from './ambiguousLinkText.js';
import { headingOutline } from './headingOutline.js';

/**
 * Build an expression that runs `fn(helpers, arg)` inside the page. Bundlers
 * with keepNames inject `__name(...)` calls into serialized functions; the
 * local shim makes those harmless in the browser.
 */
const inPage = (fn, arg) =>
  `(() => { const __name = (f) => f; return (${fn})((${afxHelpers})(), ${JSON.stringify(arg ?? null)}); })()`;

/**
 * Run our deterministic checks in the page.
 * @param {import('playwright').Page} page
 * @returns {Promise<{ findings: object[], outline: object[] }>}
 */
export async function runChecks(page) {
  const [headings, links] = await Promise.all([
    page.evaluate(inPage(headingOutline)),
    page.evaluate(inPage(ambiguousLinkText)),
  ]);
  return { findings: [...headings.findings, ...links.findings], outline: headings.outline };
}

/**
 * Element ids for axe node targets (null for iframe content or unresolvable).
 * @param {import('playwright').Page} page
 * @param {unknown[][]} targets
 */
export function resolveAxeTargets(page, targets) {
  return page.evaluate(inPage(resolveTargets, targets));
}
