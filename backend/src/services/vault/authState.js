import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM with a key id so a rotated key can still decrypt.
 * The blob is what gets stored. Job payloads never include it.
 * @param {string} raw `k1:<base64 32 bytes>,k2:...` — the first key encrypts.
 */
export function parseAuthKeys(raw) {
  if (!raw) return [];
  return raw.split(',').map((part) => {
    const split = part.trim().indexOf(':');
    if (split < 1) throw new Error('Invalid configuration: AUTH_STATE_KEYS entries are id:base64.');
    const id = part.trim().slice(0, split);
    const key = Buffer.from(part.trim().slice(split + 1), 'base64');
    if (key.length !== 32) throw new Error('Invalid configuration: each AUTH_STATE_KEYS key must be 32 bytes.');
    return { id, key };
  });
}

/**
 * @param {{ keys: { id: string, key: Buffer }[], store: { set: Function, get: Function, delete: Function, sweep: Function },
 *   ttlMs?: number }} opts
 */
export function createVault({ keys, store, ttlMs = 60 * 60 * 1000 }) {
  const active = keys[0] ?? null;
  const byId = new Map(keys.map((k) => [k.id, k.key]));

  function seal(material) {
    if (!active) throw new Error('no key');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', active.key, iv);
    const ct = Buffer.concat([cipher.update(JSON.stringify(material), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [active.id, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
  }

  function open(blob) {
    const [id, ivB64, tagB64, ctB64] = String(blob).split(':');
    const key = byId.get(id);
    if (!key) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const json = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(json);
  }

  return {
    enabled: Boolean(active),
    /** @param {string} scanId @param {unknown} material */
    async put(scanId, material) {
      await store.set(scanId, { blob: seal(material), expiresAt: Date.now() + ttlMs });
    },
    async read(scanId) {
      const row = await store.get(scanId);
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        await store.delete(scanId);
        return null;
      }
      try {
        return open(row.blob);
      } catch {
        return null;
      }
    },
    async delete(scanId) {
      await store.delete(scanId);
    },
    sweep() {
      return store.sweep(Date.now());
    },
  };
}

/** Cookies and local storage for one host. Other domains in the file are dropped. */
export function stateForHost(material, host) {
  if (!material || !host) return undefined;
  const match = (domain) => {
    const d = String(domain || '')
      .replace(/^\./, '')
      .toLowerCase();
    const h = host.toLowerCase();
    return Boolean(d) && (h === d || h.endsWith(`.${d}`));
  };
  if (material.storageState) {
    const cookies = (material.storageState.cookies ?? []).filter((c) => match(c.domain));
    const origins = (material.storageState.origins ?? []).filter((o) => {
      try {
        return new URL(o.origin).host === host;
      } catch {
        return false;
      }
    });
    if (!cookies.length && !origins.length) return undefined;
    return { cookies, origins };
  }
  const cookies = (material.cookies ?? [])
    .filter((c) => !c.domain || match(c.domain))
    .map((c) => ({ name: c.name, value: c.value, domain: c.domain || host, path: c.path || '/' }));
  if (!cookies.length) return undefined;
  return { cookies, origins: [] };
}

export function createMemorySecretStore() {
  const rows = new Map();
  return {
    async set(scanId, row) {
      rows.set(scanId, row);
    },
    async get(scanId) {
      return rows.get(scanId) ?? null;
    },
    async delete(scanId) {
      rows.delete(scanId);
    },
    async sweep(now) {
      for (const [id, row] of rows) {
        if (row.expiresAt <= now) rows.delete(id);
      }
    },
    /** Test helper. */
    has(scanId) {
      return rows.has(scanId);
    },
  };
}
