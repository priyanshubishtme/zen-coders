/**
 * In-process job queue. The orchestrator depends on this shape so a Redis/BullMQ
 * adapter can replace it later (docs/09-roadmap-future.md).
 *
 * Retries once on INTERNAL (unexpected) failures only — never on timeouts,
 * rate limits, or typed AppErrors, so a bad page cannot double Chromium load.
 *
 * @param {{ retryable?: (err: Error) => boolean, logger?: object }} [opts]
 */
export function createInProcessQueue({ retryable, logger } = {}) {
  const running = new Set();
  /** @type {Map<string, AbortController>} */
  const controllers = new Map();

  function enqueue(work, { label, onSettled } = {}) {
    const ctrl = new AbortController();
    if (label) controllers.set(label, ctrl);
    const run = (async () => {
      try {
        await work(ctrl.signal);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (retryable?.(err)) {
          logger?.warn?.({ err: err?.message, label }, 'job retrying once after INTERNAL crash');
          await work(ctrl.signal);
          return;
        }
        throw err;
      }
    })()
      .catch((err) => {
        logger?.error?.({ err, label }, 'job failed');
      })
      .finally(async () => {
        if (label) controllers.delete(label);
        await Promise.resolve(onSettled?.()).catch(() => {});
      });
    running.add(run);
    run.finally(() => running.delete(run));
    return run;
  }

  return {
    enqueue,
    /** Cooperative cancel. The in-flight page's AbortSignal fires; the queue does not just drop the job. */
    cancel(label) {
      controllers.get(label)?.abort();
    },
    idle: () => Promise.allSettled([...running]),
    get size() {
      return running.size;
    },
  };
}
