import { createHash } from 'node:crypto';

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const shortHash = (s, n = 12) => sha256(s).slice(0, n);
