export function Business() {
  return (
    <article className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Business</h1>
        <p className="mt-2 text-muted-foreground">
          Hypotheses to test, not findings. Prices and conversion rates will change once we have
          real usage.
        </p>
      </div>

      <section aria-labelledby="problem-h">
        <h2 id="problem-h" className="text-lg font-semibold">
          Problem
        </h2>
        <p className="mt-2">
          95.9% of the top million home pages still fail automated WCAG checks (WebAIM Million
          2026). Scanners hand developers a list of rule IDs. Overlay widgets promise compliance
          without changing the source — the FTC fined accessiBe $1 million for that claim. Teams
          without an accessibility specialist stall at the report.
        </p>
      </section>

      <section aria-labelledby="solution-h">
        <h2 id="solution-h" className="text-lg font-semibold">
          Solution
        </h2>
        <p className="mt-2">
          AccessFix ends in verified source patches. Deterministic fixers first, optional AI only
          for wording, templates if the model is off or over budget. A fix is “verified” only after
          a re-scan with zero regressions. We never sell compliance.
        </p>
      </section>

      <section aria-labelledby="pricing-h">
        <h2 id="pricing-h" className="text-lg font-semibold">
          Pricing (hypothesis)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">Pricing tiers</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Tier
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Price
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Scans
                </th>
                <th scope="col" className="py-2 font-medium">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Free', '$0', '20 / mo', 'HTML + one URL; last 3 scans'],
                ['Pro', '$19 / mo (₹1,499)', '500 / mo', 'Saved projects, unbranded report'],
                ['Team', '$79 / mo for 5 seats (₹5,999)', '3,000 pooled', 'GitHub Action + API'],
                ['Enterprise', 'Custom, from ~$500 / mo', 'Contracted', 'Self-hosted runner, SSO, DPA'],
              ].map((row) => (
                <tr key={row[0]} className="border-b align-top">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {row[0]}
                  </th>
                  {row.slice(1).map((cell) => (
                    <td key={cell} className="py-2 pr-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="wedge-h">
        <h2 id="wedge-h" className="text-lg font-semibold">
          GitHub Action wedge
        </h2>
        <p className="mt-2">
          Team tier (free on public repos): on each pull request, comment the score change, new
          violations, and suggested diffs. Gates: <code>--fail-under 90</code> and{' '}
          <code>--fail-on-regression</code>. The contract lives in the roadmap doc — not shipped
          yet.
        </p>
      </section>

      <section aria-labelledby="road-h">
        <h2 id="road-h" className="text-lg font-semibold">
          Roadmap
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Crawler (multi-page, same origin)</li>
          <li>SPA hydration wait strategy</li>
          <li>Auth cookies for gated pages</li>
          <li>Keyboard / focus simulation</li>
          <li>Source mapping back to JSX</li>
        </ol>
      </section>

      <section aria-labelledby="limits-h">
        <h2 id="limits-h" className="text-lg font-semibold">
          Honest limitations
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Automated checks cover only part of WCAG. A 100 is not compliance.</li>
          <li>We patch rendered HTML/CSS, not your React source — yet.</li>
          <li>AI drafts are words only and stay needs-review until you accept them.</li>
          <li>The product works with the LLM turned off.</li>
        </ul>
      </section>
    </article>
  );
}
