import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** @param {string} password */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${Buffer.from(key).toString('base64')}`;
}

/** @param {string} password @param {string} stored */
export async function verifyPassword(password, stored) {
  const [kind, saltB64, keyB64] = String(stored ?? '').split('$');
  if (kind !== 'scrypt' || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  const key = Buffer.from(await scryptAsync(password, salt, expected.length, SCRYPT));
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
