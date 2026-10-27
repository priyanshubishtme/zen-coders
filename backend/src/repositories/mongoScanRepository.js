import { MongoClient } from 'mongodb';

const TTL_SECONDS_DEFAULT = 30 * 24 * 60 * 60;

function publicScan(doc) {
  if (!doc) return null;
  const scan = { ...doc };
  delete scan._id;
  delete scan._expireAt;
  return scan;
}

/**
 * MongoDB Atlas adapter. Documents expire via TTL indexes on `_expireAt`.
 * `ready` resolves after indexes exist; `createApp` does not wait, `server.js` does.
 * @param {{ uri: string, ttlDays?: number, dbName?: string }} opts
 */
export function createMongoScanRepository({ uri, ttlDays = 30, dbName } = {}) {
  if (!uri) throw new Error('MONGODB_URI is required when STORE=mongo.');
  const ttlSeconds = Math.max(60, Math.round(ttlDays * 24 * 60 * 60)) || TTL_SECONDS_DEFAULT;
  const client = new MongoClient(uri);
  let scans;
  let repairs;
  let verifications;
  let usage;

  const ready = (async () => {
    await client.connect();
    const db = client.db(dbName);
    scans = db.collection('scans');
    repairs = db.collection('repairs');
    verifications = db.collection('verifications');
    usage = db.collection('usage');
    await Promise.all([
      scans.createIndex({ id: 1 }, { unique: true }),
      scans.createIndex({ createdAt: 1 }),
      scans.createIndex({ _expireAt: 1 }, { expireAfterSeconds: ttlSeconds }),
      repairs.createIndex({ scanId: 1 }, { unique: true }),
      repairs.createIndex({ _expireAt: 1 }, { expireAfterSeconds: ttlSeconds }),
      verifications.createIndex({ scanId: 1 }),
      verifications.createIndex({ _expireAt: 1 }, { expireAfterSeconds: ttlSeconds }),
      usage.createIndex({ at: 1 }),
      usage.createIndex({ _expireAt: 1 }, { expireAfterSeconds: ttlSeconds }),
    ]);
    return client;
  })();

  const expireAt = () => new Date();
  const coll = async () => {
    await ready;
    return { scans, repairs, verifications, usage };
  };

  return {
    kind: 'mongo',
    ready,
    async close() {
      await client.close();
    },

    async saveScan(scan) {
      const { scans: c } = await coll();
      const doc = { ...scan, _expireAt: expireAt() };
      await c.replaceOne({ id: scan.id }, doc, { upsert: true });
      return structuredClone(scan);
    },

    async updateScan(id, patch) {
      const { scans: c } = await coll();
      const result = await c.findOneAndUpdate(
        { id },
        { $set: structuredClone(patch) },
        { returnDocument: 'after' },
      );
      const doc = result && typeof result === 'object' && 'value' in result && !('id' in result) ? result.value : result;
      return publicScan(doc);
    },

    async getScan(id) {
      const { scans: c } = await coll();
      return publicScan(await c.findOne({ id }));
    },

    async listByIds(ids) {
      if (!ids.length) return [];
      const { scans: c } = await coll();
      const found = await c.find({ id: { $in: ids } }).toArray();
      const byId = new Map(found.map((d) => [d.id, publicScan(d)]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    },

    async recordUsage(entry) {
      const { usage: c } = await coll();
      await c.insertOne({ ...entry, _expireAt: expireAt() });
    },

    async usageSummary() {
      const { usage: c } = await coll();
      const n = await c.countDocuments({ kind: 'scan' });
      const first = await c.find({ kind: 'scan' }).sort({ at: 1 }).limit(1).next();
      return { scans: n, since: first?.at ?? new Date().toISOString() };
    },

    async saveRepairs(scanId, list) {
      const { repairs: c } = await coll();
      await c.replaceOne(
        { scanId },
        { scanId, items: structuredClone(list), createdAt: new Date().toISOString(), _expireAt: expireAt() },
        { upsert: true },
      );
    },

    async listRepairs(scanId) {
      const { repairs: c } = await coll();
      const doc = await c.findOne({ scanId });
      return structuredClone(doc?.items ?? []);
    },

    async saveVerification(result) {
      const { verifications: c } = await coll();
      await c.insertOne({ ...structuredClone(result), _expireAt: expireAt() });
    },

    async listVerifications(scanId) {
      const { verifications: c } = await coll();
      const docs = await c.find({ scanId }).sort({ verifiedAt: 1 }).toArray();
      return docs.map((d) => publicScan(d));
    },
  };
}
