import { nanoid } from 'nanoid';

export const LOG_STAGES = [
  'render',
  'wait',
  'axe',
  'patch',
  'verify',
  'score',
  'screenshot',
  'failed',
];

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
        message: String(message).slice(0, 500),
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

    /** Replay what already happened, then forward new events. */
    subscribe(scanId, send) {
      for (const event of events.get(scanId) ?? []) send(event);
      const set = subscribers.get(scanId) ?? new Set();
      set.add(send);
      subscribers.set(scanId, set);
      return () => set.delete(send);
    },
  };
}
