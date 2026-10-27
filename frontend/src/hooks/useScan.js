import { useCallback, useEffect, useRef, useState } from 'react';
import { createScan, getScan } from '@/lib/api.js';
import { rememberScan } from '@/lib/historyStore.js';

export const POLL_MS = 500;

/**
 * Scan lifecycle: idle -> submitting -> polling -> done | error.
 * `scan` holds the latest server copy while polling, so the UI shows the real stage.
 *
 * @param {{ pollMs?: number }} [opts]
 */
export function useScan({ pollMs = POLL_MS } = {}) {
  const [state, setState] = useState({ phase: 'idle', scan: null, error: null });
  const controller = useRef(null);

  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (input) => {
      stop();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setState({ phase: 'submitting', scan: null, error: null });
      try {
        const accepted = await createScan(input, ctrl.signal);
        setState({ phase: 'polling', scan: accepted, error: null });
        for (;;) {
          const scan = await getScan(accepted.id, ctrl.signal);
          if (ctrl.signal.aborted) return;
          if (scan.status === 'completed' || scan.status === 'failed') {
            rememberScan({
              id: scan.id,
              createdAt: scan.createdAt,
              score: scan.score?.value ?? null,
              label: scan.page?.title || (scan.input.type === 'url' ? scan.input.url : 'Pasted HTML'),
            });
            setState({ phase: 'done', scan, error: null });
            return;
          }
          setState({ phase: 'polling', scan, error: null });
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          if (ctrl.signal.aborted) return;
        }
      } catch (err) {
        if (err?.name === 'AbortError' || ctrl.signal.aborted) return;
        setState({ phase: 'error', scan: null, error: err });
      }
    },
    [pollMs, stop],
  );

  const cancel = useCallback(() => {
    stop();
    setState({ phase: 'idle', scan: null, error: null });
  }, [stop]);

  return { ...state, start, cancel };
}
