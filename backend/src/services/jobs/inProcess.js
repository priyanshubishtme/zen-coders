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

  function enqueue(work, { label } = {}) {
    const run = (async () => {
      try {
        await work();
      } catch (err) {
        if (retryable?.(err)) {
          logger?.warn?.({ err: err?.message, label }, 'job retrying once after INTERNAL crash');
          await work();
          return;
        }
        throw err;
      }
    })().catch((err) => {
      logger?.error?.({ err, label }, 'job failed');
    });
    running.add(run);
    run.finally(() => running.delete(run));
    return run;
  }

  return {
    enqueue,
    idle: () => Promise.allSettled([...running]),
    get size() {
      return running.size;
    },
  };
}
