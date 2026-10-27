import { useId, useRef, useState } from 'react';
import { FlaskConical, ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Tabs } from '@/components/ui/tabs.jsx';
import sampleHtml from '../../../samples/broken-sample.html?raw';
import demoHtml from '../../../samples/demo-script.html?raw';

const DEFAULT_MAX_BYTES = 512_000;
const kb = (n) => `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`;

/** @returns {string | null} error message */
export function validateInput(mode, html, url, maxBytes) {
  if (mode === 'html') {
    if (!html.trim()) return 'Paste some HTML first.';
    const bytes = new TextEncoder().encode(html).length;
    if (bytes > maxBytes) return `That HTML is ${kb(bytes)}; the limit is ${kb(maxBytes)}.`;
    return null;
  }
  if (!url.trim()) return 'Enter a URL first.';
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:')
      return 'Only http and https URLs can be scanned.';
  } catch {
    return 'That is not a valid URL. Include https://';
  }
  return null;
}

/**
 * @param {{ onSubmit: (input: object) => void, busy: boolean, disabledReason: string | null,
 *   maxBytes?: number }} props
 */
export function ScanForm({ onSubmit, busy, disabledReason, maxBytes = DEFAULT_MAX_BYTES }) {
  const uid = useId();
  const [mode, setMode] = useState('html');
  const [html, setHtml] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const fieldRef = useRef(null);

  const bytes = new TextEncoder().encode(html).length;
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  const submit = (e) => {
    e?.preventDefault();
    const message = validateInput(mode, html, url, maxBytes);
    setError(message);
    if (message) {
      fieldRef.current?.focus();
      return;
    }
    onSubmit(mode === 'html' ? { type: 'html', html } : { type: 'url', url: url.trim() });
  };

  const trySample = () => {
    setMode('html');
    setHtml(sampleHtml);
    setError(null);
    onSubmit({ type: 'html', html: sampleHtml });
  };

  const disabled = busy || Boolean(disabledReason);
  const describedBy = [error ? errorId : null, hintId].filter(Boolean).join(' ');

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Scan input"
      className="rounded-lg border bg-background p-4 sm:p-6"
    >
      <Tabs
        id={`${uid}-mode`}
        label="Input type"
        tabs={[
          { value: 'html', label: 'Paste HTML' },
          { value: 'url', label: 'Scan a URL' },
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v);
          setError(null);
        }}
      >
        {(value) =>
          value === 'html' ? (
            <div>
              <label htmlFor={`${uid}-html`} className="block text-sm font-medium">
                HTML to scan
              </label>
              <textarea
                id={`${uid}-html`}
                ref={fieldRef}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="mt-2 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
                placeholder="<!doctype html>…"
              />
              <p id={hintId} className="mt-1 text-sm text-muted-foreground">
                {kb(bytes)} of {kb(maxBytes)}. External CSS and images load if they are public.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor={`${uid}-url`} className="block text-sm font-medium">
                Page URL
              </label>
              <input
                id={`${uid}-url`}
                ref={fieldRef}
                type="url"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="https://example.com"
              />
              <p id={hintId} className="mt-1 text-sm text-muted-foreground">
                Public http(s) pages only. Private and internal addresses are blocked.
              </p>
            </div>
          )
        }
      </Tabs>

      {error && (
        <p id={errorId} className="mt-2 text-sm font-medium text-critical">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled}>
          <ScanSearch aria-hidden="true" className="size-4" />
          {busy ? 'Scanning…' : 'Scan'}
        </Button>
        <Button variant="outline" onClick={trySample} disabled={disabled}>
          <FlaskConical aria-hidden="true" className="size-4" />
          Try the broken sample
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setMode('html');
            setHtml(demoHtml);
            setError(null);
            onSubmit({ type: 'html', html: demoHtml });
          }}
          disabled={disabled}
        >
          Load the 3-minute demo page
        </Button>
      </div>
    </form>
  );
}
