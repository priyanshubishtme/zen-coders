import selfScan from '@/generated/self-scan.json';

const ROWS = [
  {
    name: 'AccessFix',
    tells: 'Yes, in plain language',
    source: 'Yes — verified patches to your HTML/CSS',
    rescan: 'Yes, every accepted fix',
    overlay: 'Never',
    claim: 'Never claims compliance',
  },
  {
    name: 'axe / Lighthouse',
    tells: 'Yes, as rule IDs',
    source: 'No',
    rescan: 'You re-run it yourself',
    overlay: 'No',
    claim: 'Does not claim compliance',
  },
  {
    name: 'Overlay widgets',
    tells: 'A toolbar on top of the page',
    source: 'No — the source stays broken',
    rescan: 'No',
    overlay: 'Yes, that is the product',
    claim: 'Often overclaims (see FTC / accessiBe)',
  },
];

export function LandingIntro() {
  const when = new Date(selfScan.generatedAt).toISOString().slice(0, 10);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Other tools tell you your site is broken. AccessFix fixes it.
        </h1>
        <p className="mt-4 max-w-prose text-lg text-muted-foreground">
          Paste HTML or a URL. We render it in an isolated browser, check WCAG 2.2 A and AA, and
          apply real source patches. A fix is verified only after a re-scan shows the issue gone
          and nothing else broke.
        </p>
      </div>

      <section aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="text-lg font-semibold">
          What you actually take home
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">
              AccessFix compared with axe or Lighthouse and overlay widgets
            </caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Product
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Explains issues
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Changes your source
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Verified re-scan
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Overlay
                </th>
                <th scope="col" className="py-2 font-medium">
                  Claims compliance
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.name} className="border-b align-top">
                  <th scope="row" className="py-3 pr-3 font-semibold">
                    {row.name}
                  </th>
                  <td className="py-3 pr-3">{row.tells}</td>
                  <td className="py-3 pr-3">{row.source}</td>
                  <td className="py-3 pr-3">{row.rescan}</td>
                  <td className="py-3 pr-3">{row.overlay}</td>
                  <td className="py-3">{row.claim}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="proof-heading" className="rounded-lg border bg-surface p-4">
        <h2 id="proof-heading" className="text-lg font-semibold">
          This UI, scanned by AccessFix
        </h2>
        <p className="mt-2">
          As of {when}: <strong>no automated violations found</strong>
          {selfScan.score != null ? ` (automated score ${selfScan.score})` : ''}. That is not a
          WCAG conformance claim — it only covers what axe-core can detect.
        </p>
        {selfScan.manualReview.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">Needs manual review:</p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {selfScan.manualReview.map((item) => (
                <li key={item.ruleId}>
                  {item.title} ({item.ruleId})
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing was flagged for manual review in that scan.
          </p>
        )}
      </section>
    </div>
  );
}
