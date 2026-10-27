import { useEffect, useMemo, useState } from 'react';
import { eventsUrl } from '@/lib/api.js';

const FILTERS = ['all', 'render', 'axe', 'crawl', 'patch', 'verify', 'score', 'screenshot', 'failed'];

/**
 * Live engine log. Polling still owns the score; this only streams the log.
 * @param {{ scanId: string, saved?: { id: string, at: string, stage: string, message: string }[],
 *   onEvent?: (event: { stage: string, message: string }) => void }} props
 */
export function LogPanel({ scanId, saved = [], onEvent }) {
  const [live, setLive] = useState([]);
  const [filter, setFilter] = useState('all');
  const events = merge(saved, live);

  useEffect(() => {
    const ctrl = new AbortController();
    let lastId = '';
    let stopped = false;
    const run = async () => {
      while (!stopped) {
        let res;
        try {
          res = await fetch(eventsUrl(scanId), {
            credentials: 'include',
            headers: { accept: 'text/event-stream', 'Last-Event-ID': lastId },
            signal: ctrl.signal,
          });
        } catch {
          if (ctrl.signal.aborted) return;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        if (!res.ok || !res.body?.getReader) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) return;
            buf += decoder.decode(value, { stream: true });
            const chunks = buf.split('\n\n');
            buf = chunks.pop() ?? '';
            for (const chunk of chunks) {
              const id = /^id: (.+)$/m.exec(chunk)?.[1];
              const data = chunk
                .split('\n')
                .filter((line) => line.startsWith('data: '))
                .map((line) => line.slice(6))
                .join('\n');
              if (id) lastId = id;
              if (!data) continue;
              try {
                const event = JSON.parse(data);
                onEvent?.(event);
                setLive((prev) => merge(prev, [event]));
              } catch {
                /* ignore a malformed line */
              }
            }
          }
        } catch {
          if (ctrl.signal.aborted) return;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };
    run();
    return () => {
      stopped = true;
      ctrl.abort();
    };
  }, [scanId, onEvent]);

  const visible = useMemo(
    () => (filter === 'all' ? events : events.filter((event) => event.stage === filter)),
    [events, filter],
  );
  const failed = events.some((event) => event.stage === 'failed');

  function download() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accessfix-${scanId}-log.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <details className="mt-4 rounded-lg border bg-surface p-3">
      <summary className="min-h-10 cursor-pointer text-sm font-semibold">Engine log</summary>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter log">
        {FILTERS.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={filter === stage}
            className={`min-h-10 rounded-md border px-2 text-sm ${
              filter === stage ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
            }`}
            onClick={() => setFilter(stage)}
          >
            {stage}
          </button>
        ))}
        <button type="button" className="min-h-10 rounded-md border px-2 text-sm" onClick={download}>
          Export JSON
        </button>
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-critical">
          The scan reported a failure. See the failed line below.
        </p>
      )}
      <ol className="mt-3 max-h-64 space-y-1 overflow-auto" role="status" aria-live="polite">
        {visible.length === 0 ? (
          <li className="text-sm text-muted-foreground">No log lines yet.</li>
        ) : (
          visible.map((event) => (
            <li key={event.id} className="font-mono text-xs">
              <span className="text-muted-foreground">{event.stage}</span> {event.message}
            </li>
          ))
        )}
      </ol>
    </details>
  );
}

function merge(current, incoming) {
  const seen = new Set(current.map((event) => event.id));
  const next = [...current];
  for (const event of incoming) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    next.push(event);
  }
  return next;
}
