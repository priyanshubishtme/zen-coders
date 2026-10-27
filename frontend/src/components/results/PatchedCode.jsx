import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { patchedHtmlUrl } from '@/lib/api.js';
import { CodeDisclosure } from './Workbench.jsx';

/**
 * Patched HTML ready to replace the original, plus the side-by-side editor.
 * @param {{ scanId: string, verification: import('@/lib/api.js').VerificationResult | null, visual: boolean }} props
 */
export function PatchedCode({ scanId, verification, visual }) {
  const [copied, setCopied] = useState(false);
  const html = verification?.patchedHtml ?? null;
  const copy = () =>
    navigator.clipboard?.writeText(html).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  return (
    <section id="code" aria-labelledby="code-heading" className="rounded-xl border bg-surface p-5 sm:p-6">
      <h2 id="code-heading" className="text-lg font-semibold">
        Patched code
      </h2>
      {html ? (
        <>
          <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
            This is your page with every verified fix applied and re-scanned. Replace your original file with it, or
            copy the individual diffs from each issue card. Drafts you did not accept and manual items are not in it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-110"
            >
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? 'Copied' : 'Copy patched HTML'}
            </button>
            <a
              href={patchedHtmlUrl(scanId)}
              download
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-raised"
            >
              <Download aria-hidden="true" className="size-4" />
              Download patched HTML
            </a>
          </div>
          <details className="mt-4 rounded-lg border bg-background p-3">
            <summary className="min-h-10 cursor-pointer content-center text-sm font-medium">Preview patched page</summary>
            <iframe
              title="Patched page preview"
              sandbox=""
              srcDoc={html}
              className="mt-2 h-96 w-full rounded-md border bg-white"
            />
          </details>
        </>
      ) : (
        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
          No patched copy yet. Choose Suggest fixes, review the drafts, then Apply verified fixes. Until then each
          issue card shows its own diff.
        </p>
      )}
      {visual && (
        <div className="mt-4">
          <CodeDisclosure scanId={scanId} patchedHtml={html} />
        </div>
      )}
    </section>
  );
}
