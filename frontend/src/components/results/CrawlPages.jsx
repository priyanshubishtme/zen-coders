import { CircleCheck, CircleSlash, Download, LoaderCircle, OctagonAlert } from 'lucide-react';
import { pagesZipUrl } from '@/lib/api.js';

const STATUS = {
  completed: { Icon: CircleCheck, label: 'Scanned', className: 'text-verified' },
  skipped: { Icon: CircleSlash, label: 'Skipped', className: 'text-muted-foreground' },
  failed: { Icon: OctagonAlert, label: 'Failed', className: 'text-critical' },
};

/**
 * Which pages a crawl fetched, how deep each was, and why any were skipped.
 * @param {{ scan: object, live?: boolean, zipMaxBytes?: number }} props
 */
export function CrawlPages({ scan, live = false, zipMaxBytes }) {
  const pages = scan.pages ?? [];
  const done = pages.filter((p) => p.status === 'completed').length;
  return (
    <section
      id="pages"
      aria-labelledby="pages-heading"
      className="rounded-xl border bg-surface p-5 sm:p-6"
      aria-busy={live || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="pages-heading" className="text-lg font-semibold">
            {live ? 'Crawl progress' : 'Pages crawled'}
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
            {scan.input?.url ? (
              <>
                Started at <span className="font-mono text-foreground">{scan.input.url}</span>.{' '}
              </>
            ) : null}
            We read robots.txt first, pin the crawl to the host the first page lands on
            {scan.pinnedHost ? (
              <>
                {' '}(<span className="font-mono text-foreground">{scan.pinnedHost}</span>)
              </>
            ) : null}
            , then follow its <code className="font-mono">&lt;a href&gt;</code> links breadth-first, so the shallowest
            pages are scanned first. Each page is fetched in the same isolated browser as a single scan.
          </p>
        </div>
        {!live && done > 0 && (
          <a
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-raised"
            href={pagesZipUrl(scan.id)}
          >
            <Download aria-hidden="true" className="size-4" />
            Download pages (ZIP)
          </a>
        )}
      </div>
      <p className="mt-3 text-sm" role={live ? 'status' : undefined}>
        <span className="tabular font-semibold">{done}</span> of {pages.length} pages scanned
        {scan.partial ? ' · the crawl stopped early, finished pages keep their score' : ''}
        {!live && zipMaxBytes ? ` · ZIP holds each page's original and patched HTML, up to ${Math.round(zipMaxBytes / 1048576)} MB` : ''}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Crawled pages, with depth, status and score</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Page
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Clicks from start
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Status
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Score
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Issues
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => {
              const s = STATUS[page.status] ?? STATUS.skipped;
              return (
                <tr key={`${page.depth}-${page.url}`} className="border-b align-top last:border-b-0">
                  <td className="max-w-[28rem] py-2.5 pr-3">
                    <span className="block truncate font-mono" title={page.url}>
                      {page.url}
                    </span>
                    {page.reason && <span className="block text-muted-foreground">{page.reason}</span>}
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right">{page.depth}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex items-center gap-1.5 ${s.className}`}>
                      <s.Icon aria-hidden="true" className="size-4" />
                      {s.label}
                    </span>
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right">
                    {page.status === 'completed' ? (page.score?.value ?? '—') : '—'}
                  </td>
                  <td className="tabular py-2.5 text-right">
                    {page.status === 'completed' ? (page.violations ?? []).length : '—'}
                  </td>
                </tr>
              );
            })}
            {live && (
              <tr>
                <td colSpan={5} className="py-2.5 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    Looking for the next page…
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
