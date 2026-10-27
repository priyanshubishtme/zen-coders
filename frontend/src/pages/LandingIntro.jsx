import { CircleCheck, ShieldCheck, TriangleAlert } from 'lucide-react';
import { WebThreads } from '@/components/WebThreads.jsx';
import selfScan from '@/generated/self-scan.json';

const STEPS = [
  { title: 'Scan', body: 'WCAG 2.2 A and AA rules in a real browser, plus a keyboard Tab walk.' },
  { title: 'Repair', body: 'Rule-based source patches first. AI only drafts wording you review.' },
  { title: 'Verify', body: 'The patched copy is scanned again. Any new issue blocks the fix.' },
  { title: 'Score', body: 'Before and after, with the same published formula.' },
];

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
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-xl border bg-surface"
    >
      <WebThreads />
      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <h1
            id="hero-heading"
            className="max-w-[18ch] text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]"
          >
            Other tools tell you your site is broken. AccessFix fixes it.
          </h1>
          <p className="mt-5 max-w-[56ch] text-base leading-7 text-muted-foreground sm:text-lg">
            Paste HTML, upload your HTML and CSS files, or enter a URL. We render it in an isolated browser,
            explain every failure in plain words, and patch the source. A fix counts only after a re-scan
            shows the issue gone and nothing else broke.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="How a scan works">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3 rounded-lg border bg-background p-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{step.title}</span>
                  <span className="block text-sm leading-6 text-muted-foreground">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <SampleFinding />
      </div>
    </section>
  );
}

/** A real fragment of the product's issue card, filled with sample data. */
export function SampleFinding() {
  return (
    <figure className="rounded-xl border bg-background p-4 sm:p-5" data-ui>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-critical">
          <TriangleAlert aria-hidden="true" className="size-4" />
          Critical
        </span>
        <span className="text-muted-foreground">WCAG 4.1.2 · A</span>
      </div>
      <p className="mt-3 text-lg font-semibold">Button has no accessible name</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Screen readers announce only “button”, so people cannot tell what it does.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border bg-surface p-3 font-mono text-[13px] leading-6">
        <code>
          <span className="block text-critical">- &lt;button class="menu"&gt;</span>
          <span className="block text-verified">+ &lt;button class="menu" aria-label="Open menu"&gt;</span>
        </code>
      </pre>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-verified">
          <CircleCheck aria-hidden="true" className="size-4" />
          Verified by re-scan · 0 regressions
        </span>
        <span className="text-muted-foreground">Sample data</span>
      </figcaption>
    </figure>
  );
}

export function LandingProof() {
  const when = new Date(selfScan.generatedAt).toISOString().slice(0, 10);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section aria-labelledby="compare-heading" className="rounded-xl border bg-surface p-5 sm:p-6">
        <h2 id="compare-heading" className="text-lg font-semibold">
          What you actually take home
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">
              AccessFix compared with axe or Lighthouse and overlay widgets
            </caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
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
                <tr key={row.name} className="border-b align-top last:border-b-0">
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

      <section aria-labelledby="proof-heading" className="rounded-xl border bg-surface p-5 sm:p-6">
        <h2 id="proof-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck aria-hidden="true" className="size-5 text-verified" />
          This UI, scanned by AccessFix
        </h2>
        <p className="mt-3 text-sm leading-6">
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
