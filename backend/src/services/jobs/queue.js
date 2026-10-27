import { createInProcessQueue } from './inProcess.js';

/**
 * REDIS_URL selects BullMQ. The worker stays inside this process.
 * Without Redis, `npm run dev` and `npm test` use the in-process queue.
 * Job data is `{ scanId }` only.
 *
 * @param {{ redisUrl?: string, logger?: object, concurrency?: number,
 *   handler?: (scanId: string, signal: AbortSignal) => Promise<void> }} opts
 */
export function createJobQueue({ redisUrl, logger, concurrency = 2, handler } = {}) {
  if (!redisUrl) return createInProcessQueue({ logger });
  return createBullQueue({ url: redisUrl, logger, concurrency, handler });
}

function createBullQueue({ url, logger, concurrency, handler }) {
  const controllers = new Map();
  const settled = new Map();
  let started = null;

  async function backend() {
    if (!started) {
      started = import('bullmq')
        .then(({ Queue, Worker }) => {
          const connection = { url, maxRetriesPerRequest: null };
          const queue = new Queue('accessfix-scans', { connection });
          const worker = new Worker(
            'accessfix-scans',
            async (job) => {
              const scanId = job.data?.scanId;
              if (!scanId) return;
              const ctrl = new AbortController();
              controllers.set(scanId, ctrl);
              try {
                await handler?.(scanId, ctrl.signal);
              } finally {
                controllers.delete(scanId);
                const done = settled.get(scanId);
                settled.delete(scanId);
                await done?.();
              }
            },
            { connection, concurrency },
          );
          worker.on('failed', (job, err) => logger?.error?.({ err, scanId: job?.data?.scanId }, 'job failed'));
          return { queue, worker };
        })
        .catch((err) => {
          throw new Error(
            `REDIS_URL is set but BullMQ could not be loaded (${err.message}). Install dependencies and try again.`,
          );
        });
    }
    return started;
  }

  const running = new Set();

  function enqueue(_work, { label, onSettled } = {}) {
    if (!label) throw new Error('BullMQ jobs need a scan id.');
    if (onSettled) settled.set(label, onSettled);
    const run = backend()
      .then(({ queue }) => queue.add('scan', { scanId: label }, { removeOnComplete: true, removeOnFail: 20 }))
      .catch((err) => logger?.error?.({ err, label }, 'job failed to enqueue'));
    running.add(run);
    run.finally(() => running.delete(run));
    return run;
  }

  return {
    enqueue,
    cancel(label) {
      controllers.get(label)?.abort();
    },
    idle: () => Promise.allSettled([...running]),
    async close() {
      const got = await started?.catch(() => null);
      await got?.worker?.close();
      await got?.queue?.close();
    },
    get size() {
      return running.size;
    },
  };
}
