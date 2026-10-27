/**
 * In-page check (serialized; keep self-contained). Builds the heading outline
 * across shadow DOM and flags: no h1, more than one h1, skipped levels, empty
 * headings. `overlaps` lists axe rules reporting the same thing, so the
 * normalizer can merge instead of duplicating.
 * @param {ReturnType<typeof import('./domHelpers.js').afxHelpers>} h
 */
export function headingOutline(h) {
  const outline = [];
  for (const el of h.composed(document.documentElement)) {
    const tag = el.localName;
    let level = null;
    if (/^h[1-6]$/.test(tag)) level = Number(tag[1]);
    else if (el.getAttribute('role') === 'heading') {
      level = Number.parseInt(el.getAttribute('aria-level') ?? '', 10) || 2;
    }
    if (level === null || h.isHidden(el)) continue;
    outline.push({ el, level, text: h.accName(el).slice(0, 120) });
  }

  const finding = (ruleId, el, impact, summary, overlaps, data) => ({
    ruleId,
    impact,
    afxId: h.idOf(el),
    target: h.target(el),
    html: h.snippet(el),
    failureSummary: summary,
    overlaps,
    data,
  });

  const findings = [];
  const h1s = outline.filter((x) => x.level === 1);
  if (h1s.length === 0) {
    findings.push(
      finding(
        'afx-heading-missing-h1',
        document.documentElement,
        'moderate',
        'The page has no level-one heading.',
        ['page-has-heading-one'],
        {},
      ),
    );
  }
  for (const extra of h1s.slice(1)) {
    findings.push(
      finding(
        'afx-heading-multiple-h1',
        extra.el,
        'minor',
        `This is level-one heading number ${h1s.indexOf(extra) + 1} on the page.`,
        [],
        { count: h1s.length },
      ),
    );
  }
  outline.forEach((x, i) => {
    const prev = outline[i - 1];
    if (prev && x.level > prev.level + 1) {
      findings.push(
        finding(
          'afx-heading-skip',
          x.el,
          'moderate',
          `Heading jumps from level ${prev.level} to level ${x.level}.`,
          ['heading-order'],
          { from: prev.level, to: x.level },
        ),
      );
    }
    if (!x.text.trim()) {
      findings.push(
        finding(
          'afx-heading-empty',
          x.el,
          'minor',
          'This heading has no text.',
          ['empty-heading'],
          {},
        ),
      );
    }
  });

  return {
    findings,
    outline: outline.map((x) => ({
      level: x.level,
      text: x.text,
      afxId: h.idOf(x.el),
      target: h.target(x.el),
    })),
  };
}
