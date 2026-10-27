import { Check, Minus } from 'lucide-react';

const fmt = (n) => (n == null ? '—' : new Intl.NumberFormat().format(n));

const FEATURES = [
  ['Paste HTML, upload HTML + CSS, scan one URL', true, true, true],
  ['Fixes, verification, shareable report', true, true, true],
  ['Crawl a whole site', false, true, true],
  ['Scan a page behind a login', false, true, true],
  ['Projects and saved scans', false, true, true],
  ['Revocable share links', false, true, true],
];

const COMMANDS = [
  {
    title: 'Turn quotas on',
    why: 'Quotas are off by default so local testing is never blocked. Meters still count while they are off.',
    code: '# .env\nQUOTAS_ENABLED=true\n# then restart: npm run dev',
  },
  {
    title: 'Make someone Pro (any store)',
    why: 'Emails listed here are Pro the next time they sign up or sign in. Works with the memory store.',
    code: '# .env\nPRO_EMAILS=owner@example.com,teammate@example.com',
  },
  {
    title: 'Change a plan in MongoDB',
    why: 'For accounts that already exist when STORE=mongo. There is no admin screen.',
    code: 'npm run plan:pro -- user@example.com pro\nnpm run plan:pro -- user@example.com free',
  },
  {
    title: 'Adjust the limits',
    why: 'Every limit is an environment variable. Pro token caps must stay above Free, or the API refuses to start.',
    code: 'FREE_SCANS_DAY=30\nFREE_PAGES_DAY=100\nFREE_TOKENS_DAY=50000\nFREE_CRAWL_PAGES=5\nPRO_SCANS_DAY=300\nPRO_PAGES_DAY=1000\nPRO_TOKENS_DAY=300000\nPRO_CRAWL_PAGES=10\nLOGGED_OUT_SCANS_DAY=100\nLLM_TOKEN_DAILY_CEILING=0   # 0 = no server-wide ceiling',
  },
];

export function Business({ health }) {
  const quotasOn = health?.quotas === 'on';
  const plans = health?.plans;
  const rows = [
    ['Scans per day', plans?.loggedOutScansDay, plans?.free.scansDay, plans?.pro.scansDay],
    ['Pages per day', null, plans?.free.pagesDay, plans?.pro.pagesDay],
    ['AI tokens per day', null, plans?.free.tokensDay, plans?.pro.tokensDay],
    ['Pages per crawl', null, plans?.free.crawlPages, plans?.pro.crawlPages],
  ];
  return (
    <div className="space-y-8">
      <div className="max-w-[75ch]">
        <h1 className="text-2xl font-semibold tracking-tight">Plans, limits and the business case</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The limits below are read from this server right now. Prices further down are hypotheses to test, not
          findings.
        </p>
      </div>

      <section aria-labelledby="limits-now" className="rounded-xl border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="limits-now" className="text-lg font-semibold">
            Limits on this server
          </h2>
          <p
            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm ${quotasOn ? 'border-verified text-verified' : 'text-muted-foreground'}`}
            role="status"
          >
            Quotas {quotasOn ? 'on: limits are enforced' : 'off: limits are shown, not enforced'}
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Daily limits by plan</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Limit
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Signed out
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Free
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, out, free, pro]) => (
                <tr key={name} className="border-b">
                  <th scope="row" className="py-2.5 pr-3 font-medium">
                    {name}
                  </th>
                  <td className="tabular py-2.5 pr-3 text-right">{out == null ? '—' : `${fmt(out)} per network`}</td>
                  <td className="tabular py-2.5 pr-3 text-right">{fmt(free)}</td>
                  <td className="tabular py-2.5 text-right">{fmt(pro)}</td>
                </tr>
              ))}
              {FEATURES.map(([name, out, free, pro]) => (
                <tr key={name} className="border-b last:border-b-0">
                  <th scope="row" className="py-2.5 pr-3 font-medium">
                    {name}
                  </th>
                  {[out, free, pro].map((yes, i) => (
                    <td key={i} className={`py-2.5 text-right ${i < 2 ? 'pr-3' : ''}`}>
                      {yes ? (
                        <Check aria-hidden="true" className="ml-auto size-4 text-verified" />
                      ) : (
                        <Minus aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{yes ? 'Included' : 'Not included'}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Daily counters reset at midnight UTC. With quotas off, every account crawls up to{' '}
          {fmt(health?.crawl?.maxPages)} pages, {fmt(health?.crawl?.maxDepth)} clicks deep. The largest page we accept is{' '}
          {health ? `${(health.limits.maxHtmlBytes / 1_000_000).toFixed(1)} MB` : '—'} of HTML.
        </p>
      </section>

      <section aria-labelledby="commands" className="rounded-xl border bg-surface p-5 sm:p-6">
        <h2 id="commands" className="text-lg font-semibold">
          How to control plans
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {COMMANDS.map((c) => (
            <div key={c.title} className="rounded-lg border bg-background p-4">
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{c.why}</p>
              <pre className="mt-3 overflow-x-auto rounded-md border bg-surface p-3 font-mono text-[13px] leading-6">
                <code>{c.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="problem-h" className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 id="problem-h" className="text-lg font-semibold">
            Problem
          </h2>
          <p className="mt-2 text-sm leading-6">
            95.9% of the top million home pages still fail automated WCAG checks (WebAIM Million 2026). Scanners hand
            developers a list of rule IDs. Overlay widgets promise compliance without changing the source — the FTC
            fined accessiBe $1 million for that claim. Teams without an accessibility specialist stall at the report.
          </p>
        </section>
        <section aria-labelledby="solution-h" className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 id="solution-h" className="text-lg font-semibold">
            Solution
          </h2>
          <p className="mt-2 text-sm leading-6">
            AccessFix ends in verified source patches. Deterministic fixers first, optional AI only for wording,
            templates if the model is off or over budget. A fix is “verified” only after a re-scan with zero
            regressions. We never sell compliance.
          </p>
        </section>
      </div>

      <section aria-labelledby="pricing-h" className="rounded-xl border bg-surface p-5 sm:p-6">
        <h2 id="pricing-h" className="text-lg font-semibold">
          Pricing (hypothesis)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="mb-2 text-left text-sm text-muted-foreground">
              Pricing hypothesis. This table is not the quota the server enforces.
            </caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
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
                <tr key={row[0]} className="border-b align-top last:border-b-0">
                  <th scope="row" className="py-2.5 pr-3 font-semibold">
                    {row[0]}
                  </th>
                  {row.slice(1).map((cell) => (
                    <td key={cell} className="py-2.5 pr-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="road-h" className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 id="road-h" className="text-lg font-semibold">
            Roadmap
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            <li>Crawler, SPA wait, login-state scans, keyboard checks, accounts and quotas — shipped.</li>
            <li>Source mapping back to JSX — not built.</li>
            <li>
              GitHub Action with <code className="font-mono">--fail-under 90</code> and{' '}
              <code className="font-mono">--fail-on-regression</code> — not built.
            </li>
          </ul>
        </section>
        <section aria-labelledby="honest-h" className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 id="honest-h" className="text-lg font-semibold">
            Honest limitations
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            <li>Automated checks cover only part of WCAG. A 100 is not compliance.</li>
            <li>We patch rendered HTML/CSS, not your React source — yet.</li>
            <li>AI drafts are words only and stay needs-review until you accept them.</li>
            <li>The product works with the LLM turned off.</li>
            <li>No password reset and no email verification yet.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
