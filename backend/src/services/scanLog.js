import { nanoid } from 'nanoid';

export const LOG_STAGES = [
  'render',
  'wait',
  'axe',
  'patch',
  'verify',
  'score',
  'screenshot',
  'crawl',
  'failed',
];

function safeMessage(message) {
  const raw = String(message ?? '');
  if (/cookie|storageState|set-cookie|authorization/i.test(raw)) return 'Details omitted.';
  return raw.replace(/<[^>]*>/g, '').slice(0, 500);
}

/**
 * In-process log for one API process. The finished list is also saved on the
 * scan so a refresh can replay it. SSE subscribers hear events as they happen.
 */
export function createScanLog() {
  /** @type {Map<string, object[]>} */
  const events = new Map();
  /** @type {Map<string, Set<(event: object) => void>>} */
  const subscribers = new Map();

  return {
    /**
     * @param {string} scanId
     * @param {{ stage: string, message: string, ms?: number | null }} input
     */
    publish(scanId, { stage, message, ms = null }) {
      const event = {
        id: `e_${nanoid(10)}`,
        at: new Date().toISOString(),
        stage,
        message: safeMessage(message),
        ms: ms == null ? null : ms,
      };
      const list = events.get(scanId) ?? [];
      list.push(event);
      events.set(scanId, list);
      for (const send of subscribers.get(scanId) ?? []) send(event);
      return event;
    },

    list(scanId) {
      return events.get(scanId) ?? [];
    },

    /** Replay what already happened, then forward new events. `afterId` resumes a dropped stream. */
    subscribe(scanId, send, { afterId } = {}) {
      const list = events.get(scanId) ?? [];
      const from = afterId ? list.findIndex((event) => event.id === afterId) + 1 : 0;
      for (const event of list.slice(Math.max(0, from))) send(event);
      const set = subscribers.get(scanId) ?? new Set();
      set.add(send);
      subscribers.set(scanId, set);
      return () => set.delete(send);
    },
  };
}
