import { randomBytes, createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { nanoid } from 'nanoid';
import { hashPassword } from '../auth/password.js';

const HOUR = 60 * 60 * 1000;

function token() {
  return randomBytes(32).toString('base64url');
}

function shareHash(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Users, sessions, shares, projects, login windows, encrypted-scan secrets,
 * and UTC-day counters. Memory by default. Mongo when `uri` is set so the
 * ceiling, login delay, and secrets survive a restart.
 *
 * @param {{ uri?: string, ttlDays?: number }} [opts]
 */
export function createAccountStore({ uri = '', ttlDays = 30 } = {}) {
  const users = new Map();
  const sessions = new Map();
  const shares = new Map();
  const projects = new Map();
  const secrets = new Map();
  const counters = new Map();
  const windows = new Map();
  /** @type {import('mongodb').Db | null} */
  let db = null;
  /** @type {import('mongodb').MongoClient | null} */
  let client = null;

  const ready = uri
    ? (async () => {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db();
        const ttl = Math.max(60, Math.round(ttlDays * 24 * 60 * 60));
        await Promise.all([
          db.collection('users').createIndex({ email: 1 }, { unique: true }),
          db.collection('sessions').createIndex({ token: 1 }, { unique: true }),
          db.collection('sessions').createIndex({ _expireAt: 1 }, { expireAfterSeconds: 0 }),
          db.collection('shares').createIndex({ hash: 1 }, { unique: true }),
          db.collection('secrets').createIndex({ scanId: 1 }, { unique: true }),
          db.collection('secrets').createIndex({ _expireAt: 1 }, { expireAfterSeconds: 0 }),
          db.collection('counters').createIndex({ key: 1 }, { unique: true }),
          db.collection('windows').createIndex({ key: 1 }, { unique: true }),
          db.collection('projects').createIndex({ userId: 1 }),
        ]);
        void ttl;
        return db;
      })()
    : Promise.resolve(null);

  async function col(name) {
    await ready;
    return db ? db.collection(name) : null;
  }

  return {
    kind: uri ? 'mongo' : 'memory',
    ready,
    async close() {
      await client?.close();
    },

    async createUser({ email, password, plan = 'free' }) {
      const existing = await this.findUserByEmail(email);
      if (existing) return null;
      const user = {
        id: `u_${nanoid(16)}`,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        plan,
        scanIds: [],
        createdAt: new Date().toISOString(),
      };
      const project = { id: `p_${nanoid(12)}`, userId: user.id, name: 'Personal' };
      users.set(user.email, user);
      projects.set(project.id, project);
      const c = await col('users');
      if (c) {
        await c.insertOne({ ...user });
        await (await col('projects')).insertOne(project);
      }
      return publicUser(user, [project]);
    },

    async findUserByEmail(email) {
      const key = email.toLowerCase();
      const cached = users.get(key);
      if (cached) return cached;
      const c = await col('users');
      if (!c) return null;
      const doc = await c.findOne({ email: key });
      if (!doc) return null;
      const user = { ...doc };
      delete user._id;
      users.set(key, user);
      return user;
    },

    async setPlan(email, plan) {
      const user = await this.findUserByEmail(email);
      if (!user) return null;
      user.plan = plan;
      users.set(user.email, user);
      const c = await col('users');
      if (c) await c.updateOne({ email: user.email }, { $set: { plan } });
      return publicUser(user, await this.listProjects(user.id));
    },

    async createSession(userId) {
      const user = [...users.values()].find((u) => u.id === userId);
      const raw = token();
      const row = { token: raw, userId, createdAt: Date.now() };
      sessions.set(raw, row);
      const c = await col('sessions');
      if (c) {
        await c.insertOne({ ...row, _expireAt: new Date(Date.now() + 14 * 24 * HOUR) });
      }
      return { token: raw, user };
    },

    async readSession(raw) {
      if (!raw) return null;
      let row = sessions.get(raw) ?? null;
      if (!row) {
        const c = await col('sessions');
        if (c) {
          const doc = await c.findOne({ token: raw });
          if (doc) {
            row = doc;
            sessions.set(raw, row);
          }
        }
      }
      if (!row) return null;
      let user = [...users.values()].find((u) => u.id === row.userId);
      if (!user) {
        const c = await col('users');
        if (c) {
          const doc = await c.findOne({ id: row.userId });
          if (doc) {
            user = { ...doc };
            delete user._id;
            users.set(user.email, user);
          }
        }
      }
      if (!user) return null;
      return { userId: user.id, email: user.email, plan: user.plan, token: raw };
    },

    async deleteSession(raw) {
      sessions.delete(raw);
      const c = await col('sessions');
      if (c) await c.deleteOne({ token: raw });
    },

    /** Drop every session for this user, then issue a new one. */
    async rotateSession(userId) {
      for (const [raw, row] of sessions) {
        if (row.userId === userId) sessions.delete(raw);
      }
      const c = await col('sessions');
      if (c) await c.deleteMany({ userId });
      return this.createSession(userId);
    },

    async listProjects(userId) {
      const local = [...projects.values()].filter((p) => p.userId === userId);
      if (local.length) return local.map(({ id, name }) => ({ id, name }));
      const c = await col('projects');
      if (!c) return [];
      const docs = await c.find({ userId }).toArray();
      return docs.map((p) => ({ id: p.id, name: p.name }));
    },

    async noteScan(userId, scanId) {
      const user = [...users.values()].find((u) => u.id === userId);
      if (user) {
        user.scanIds = [scanId, ...(user.scanIds ?? [])].slice(0, 50);
        users.set(user.email, user);
      }
      const c = await col('users');
      if (c) {
        await c.updateOne({ id: userId }, { $push: { scanIds: { $each: [scanId], $position: 0, $slice: 50 } } });
      }
    },

    async scansFor(userId) {
      const user = [...users.values()].find((u) => u.id === userId);
      if (user?.scanIds) return user.scanIds;
      const c = await col('users');
      if (!c) return [];
      const doc = await c.findOne({ id: userId });
      return doc?.scanIds ?? [];
    },

    async createShare({ scanId, userId, expiresAt }) {
      const raw = nanoid(32);
      const row = { hash: shareHash(raw), scanId, userId, expiresAt, revoked: false };
      shares.set(row.hash, row);
      const c = await col('shares');
      if (c) await c.insertOne(row);
      return raw;
    },

    async readShare(raw) {
      const hash = shareHash(raw);
      let row = shares.get(hash) ?? null;
      if (!row) {
        const c = await col('shares');
        if (c) row = await c.findOne({ hash });
      }
      if (!row || row.revoked) return null;
      return { scanId: row.scanId, userId: row.userId, expiresAt: row.expiresAt ?? null, revoked: false };
    },

    async revokeShare(raw, userId) {
      const hash = shareHash(raw);
      const row = shares.get(hash);
      if (row && row.userId === userId) row.revoked = true;
      const c = await col('shares');
      if (c) await c.updateOne({ hash, userId }, { $set: { revoked: true } });
      return Boolean(row?.revoked);
    },

    /**
     * Failures for this email in the current hour. Delay starts at 1s and doubles, capped at 15s.
     * The next attempt before `waitMs` elapses is told to wait. The account is never locked.
     */
    async loginGate(email) {
      const key = `login:${email.toLowerCase()}`;
      const row = await loadWindow(windows, () => col('windows'), key);
      if (!row || Date.now() - row.start >= HOUR) return { waitMs: 0, count: 0 };
      if (row.nextAt && row.nextAt > Date.now()) return { waitMs: row.nextAt - Date.now(), count: row.count };
      return { waitMs: 0, count: row.count };
    },

    async recordLoginFailure(email) {
      const key = `login:${email.toLowerCase()}`;
      const now = Date.now();
      let row = await loadWindow(windows, () => col('windows'), key);
      if (!row || now - row.start >= HOUR) row = { count: 0, start: now, nextAt: 0 };
      row.count += 1;
      const delay = Math.min(15_000, 1000 * 2 ** (row.count - 1));
      row.nextAt = now + delay;
      windows.set(key, row);
      const c = await col('windows');
      if (c) await c.updateOne({ key }, { $set: row }, { upsert: true });
      return { delayMs: delay, count: row.count };
    },

    async clearLoginFailures(email) {
      const key = `login:${email.toLowerCase()}`;
      windows.delete(key);
      const c = await col('windows');
      if (c) await c.deleteOne({ key });
    },

    /** @returns {Promise<number>} attempts in the current hour, after incrementing */
    async bumpHour(bucket, id) {
      const key = `${bucket}:${id}`;
      const now = Date.now();
      let row = await loadWindow(windows, () => col('windows'), key);
      if (!row || now - row.start >= HOUR) row = { count: 0, start: now };
      row.count += 1;
      windows.set(key, row);
      const c = await col('windows');
      if (c) await c.updateOne({ key }, { $set: row }, { upsert: true });
      return row.count;
    },

    async addCounter(key, n) {
      const c = await col('counters');
      if (c) {
        const raw = await c.findOneAndUpdate(
          { key },
          { $inc: { n }, $setOnInsert: { key } },
          { upsert: true, returnDocument: 'after' },
        );
        const doc = raw && typeof raw === 'object' && 'value' in raw && !('n' in raw) ? raw.value : raw;
        const value = doc?.n ?? n;
        counters.set(key, value);
        return value;
      }
      const next = (counters.get(key) ?? 0) + n;
      counters.set(key, next);
      return next;
    },

    async getCounter(key) {
      const c = await col('counters');
      if (c) {
        const doc = await c.findOne({ key });
        return doc?.n ?? 0;
      }
      return counters.get(key) ?? 0;
    },

    async putSecret(scanId, blob, expiresAt) {
      const row = { scanId, blob, expiresAt };
      secrets.set(scanId, row);
      const c = await col('secrets');
      if (c) await c.replaceOne({ scanId }, { ...row, _expireAt: new Date(expiresAt) }, { upsert: true });
    },

    async getSecret(scanId) {
      let row = secrets.get(scanId) ?? null;
      if (!row) {
        const c = await col('secrets');
        if (c) row = await c.findOne({ scanId });
      }
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        await this.deleteSecret(scanId);
        return null;
      }
      return row;
    },

    async deleteSecret(scanId) {
      secrets.delete(scanId);
      const c = await col('secrets');
      if (c) await c.deleteOne({ scanId });
    },

    async sweepSecrets(now) {
      for (const [id, row] of secrets) {
        if (row.expiresAt <= now) secrets.delete(id);
      }
      const c = await col('secrets');
      if (c) await c.deleteMany({ expiresAt: { $lte: now } });
    },
  };
}

function publicUser(user, projectList) {
  return { id: user.id, email: user.email, plan: user.plan, projects: projectList };
}

async function loadWindow(windows, col, key) {
  if (windows.has(key)) return { ...windows.get(key) };
  const c = await col();
  if (!c) return null;
  const doc = await c.findOne({ key });
  if (!doc) return null;
  const row = { count: doc.count ?? 0, start: doc.start ?? 0, nextAt: doc.nextAt ?? 0 };
  windows.set(key, row);
  return { ...row };
}
