/**
 * In-page check (serialized; keep self-contained). Flags links whose whole
 * accessible name is a vague phrase like "click here", unless
 * aria-describedby supplies extra context. Maps to WCAG 2.4.4.
 * @param {ReturnType<typeof import('./domHelpers.js').afxHelpers>} h
 */
export function ambiguousLinkText(h) {
  const AMBIGUOUS = new Set([
    'click',
    'click here',
    'click this',
    'continue',
    'details',
    'find out more',
    'go',
    'here',
    'learn more',
    'link',
    'more',
    'more info',
    'more information',
    'read',
    'read more',
    'see more',
    'start',
    'tap here',
    'this',
    'this link',
    'view',
    'view more',
  ]);
  const findings = [];
  for (const el of h.composed(document.documentElement)) {
    const isLink =
      (el.localName === 'a' && el.hasAttribute('href')) || el.getAttribute('role') === 'link';
    if (!isLink || h.isHidden(el) || el.hasAttribute('aria-describedby')) continue;
    const name = h.accName(el);
    const normalized = name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!AMBIGUOUS.has(normalized)) continue;
    findings.push({
      ruleId: 'afx-link-ambiguous',
      impact: 'moderate',
      afxId: h.idOf(el),
      marker: el.getAttribute('data-afx-v'),
      target: h.target(el),
      html: h.snippet(el),
      failureSummary: `The link text "${name}" does not say where the link goes.`,
      overlaps: [],
      data: { text: name },
    });
  }
  return { findings };
}
