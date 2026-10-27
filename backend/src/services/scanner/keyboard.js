/**
 * Scripted Tab walk. Results are checks with a confidence, not axe violations,
 * so they never change the score or the auto-repair list.
 * @param {import('playwright').Page} page
 * @param {number} maxStops
 */
export async function walkFocus(page, maxStops) {
  const interactive = await page.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, summary, [tabindex]';
    const root = globalThis.document;
    return [...root.querySelectorAll(sel)]
      .filter((el) => !el.disabled && el.getAttribute('tabindex') !== '-1')
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || el.getAttribute('name') || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80),
      }));
  });

  /** @type {{ tag: string, name: string, focusVisible: boolean }[]} */
  const stops = [];
  await page.locator('body').click({ position: { x: 1, y: 1 }, timeout: 1000 }).catch(() => {});
  for (let n = 0; n < maxStops; n += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const root = globalThis.document;
      const el = root.activeElement;
      if (!el || el === root.body || el === root.documentElement) return null;
      const style = root.defaultView.getComputedStyle(el);
      const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow && style.boxShadow !== 'none';
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80),
        focusVisible: Boolean(outline || shadow),
      };
    });
    if (!info) break;
    if (stops.length && stops[0].tag === info.tag && stops[0].name === info.name) break;
    stops.push(info);
  }

  const reached = new Set(stops.map((s) => `${s.tag}:${s.name}`));
  const unreachable = interactive.filter((el) => !reached.has(`${el.tag}:${el.name}`));
  const missing = stops.filter((s) => !s.focusVisible);
  const checks = [
    {
      id: 'focus-order',
      confidence: 'medium',
      message: `Tab reached ${stops.length} control${stops.length === 1 ? '' : 's'}.`,
    },
  ];
  if (unreachable.length) {
    checks.push({
      id: 'unreachable',
      confidence: 'medium',
      message: `${unreachable.length} interactive control${unreachable.length === 1 ? '' : 's'} were not reached by Tab.`,
    });
  }
  if (missing.length) {
    checks.push({
      id: 'focus-visible',
      confidence: 'low',
      message: `${missing.length} focused control${missing.length === 1 ? '' : 's'} had no obvious visible focus style.`,
    });
  }
  return { stops, checks };
}
