/**
 * Set a user's plan in Mongo. There is no admin UI.
 * Usage: node backend/src/scripts/setPlan.js user@example.com pro
 * Requires STORE=mongo and MONGODB_URI (read from the environment).
 */
import { MongoClient } from 'mongodb';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const plan = process.argv[3] ?? 'pro';
if (!email || !['free', 'pro'].includes(plan)) {
  console.error('Usage: node backend/src/scripts/setPlan.js user@example.com free|pro');
  process.exit(1);
}
const uri = process.env.MONGODB_URI;
if (process.env.STORE !== 'mongo' || !uri) {
  console.error('Set STORE=mongo and MONGODB_URI. This script does not change the in-memory store.');
  process.exit(1);
}
const client = new MongoClient(uri);
await client.connect();
const result = await client.db().collection('users').updateOne({ email }, { $set: { plan } });
await client.close();
if (!result.matchedCount) {
  console.error(`No account for ${email}.`);
  process.exit(1);
}
console.log(`${email} is now ${plan}.`);
