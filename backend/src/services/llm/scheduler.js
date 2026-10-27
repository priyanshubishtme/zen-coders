/** Token bucket: `rate` tokens per minute, bursting up to `capacity`. */
export function createTokenBucket({ rate, capacity, now = Date.now }) {
  let tokens = capacity;
  let last = now();

  const refill = () => {
    const t = now();
    tokens = Math.min(capacity, tokens + ((t - last) / 60_000) * rate);
    last = t;
  };

  return {
    /** Milliseconds to wait before `n` tokens can be taken (0 if available now). */
    waitMs(n) {
      refill();
      if (tokens >= n) return 0;
      if (rate <= 0) return 60_000;
      return Math.ceil(((n - tokens) / rate) * 60_000);
    },
    take(n) {
      refill();
      if (tokens < n) return false;
      tokens -= n;
      return true;
    },
    remaining() {
      refill();
      return Math.max(0, Math.floor(tokens));
    },
  };
}

/**
 * Circuit: 5 failures inside 60s opens it; after 30s one probe (half-open).
 * @param {{ now?: () => number, openMs?: number, windowMs?: number, threshold?: number }} [opts]
 */
export function createCircuit({
  now = Date.now,
  openMs = 30_000,
  windowMs = 60_000,
  threshold = 5,
} = {}) {
  const failures = [];
  let openedAt = 0;
  let probing = false;

  const prune = (t) => {
    while (failures.length && t - failures[0] > windowMs) failures.shift();
  };

  return {
    status() {
      const t = now();
      if (openedAt && t - openedAt < openMs) return 'open';
      if (openedAt && t - openedAt >= openMs) return 'half-open';
      return 'closed';
    },
    allow() {
      const s = this.status();
      if (s === 'open') return false;
      if (s === 'half-open') {
        if (probing) return false;
        probing = true;
      }
      return true;
    },
    success() {
      failures.length = 0;
      openedAt = 0;
      probing = false;
    },
    failure() {
      const t = now();
      prune(t);
      failures.push(t);
      probing = false;
      if (failures.length >= threshold) openedAt = t;
    },
  };
}

/** Full jitter: sleep = random(0, min(20s, 0.5s × 2^attempt)). Honour Retry-After when set. */
export function backoffMs(attempt, retryAfterSec = null) {
  if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(20_000, retryAfterSec * 1000);
  }
  const cap = Math.min(20_000, 500 * 2 ** attempt);
  return Math.floor(Math.random() * cap);
}

export function parseRetryAfter(res) {
  const ra = res.headers?.get?.('retry-after') ?? res.headers?.['retry-after'];
  if (ra == null) return null;
  const n = Number(ra);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
