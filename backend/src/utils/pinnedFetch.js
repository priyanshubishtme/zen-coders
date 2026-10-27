import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import zlib from 'node:zlib';
import { AppError } from './errors.js';

const HOP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
]);
const DROP_RESPONSE_HEADERS = new Set([
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
]);

function decode(body, encoding, maxBytes) {
  const opts = { maxOutputLength: maxBytes };
  switch ((encoding ?? '').toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return zlib.gunzipSync(body, opts);
    case 'deflate':
      return zlib.inflateSync(body, opts);
    case 'br':
      return zlib.brotliDecompressSync(body, opts);
    default:
      return body;
  }
}

/**
 * One HTTP request to an already-validated address. Redirects are returned,
 * not followed, so the browser re-enters the safety check for each hop.
 *
 * @param {{ url: URL, address: string, family: number, method: string,
 *   headers: Record<string, string>, body?: Buffer | null, timeoutMs: number, maxBytes: number }} req
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: Buffer }>}
 */
export function pinnedFetch({ url, address, family, method, headers, body, timeoutMs, maxBytes }) {
  const client = url.protocol === 'https:' ? https : http;
  const outHeaders = Object.fromEntries(
    Object.entries(headers).filter(([k]) => !HOP_HEADERS.has(k.toLowerCase())),
  );
  outHeaders['accept-encoding'] = 'gzip, deflate, br';

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: outHeaders,
        servername: isIP(url.hostname) ? undefined : url.hostname,
        timeout: timeoutMs,
        lookup: (_host, opts, cb) =>
          opts?.all ? cb(null, [{ address, family }]) : cb(null, address, family),
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new AppError('FETCH_FAILED', `Response exceeded ${maxBytes} bytes.`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            const decoded = decode(
              Buffer.concat(chunks),
              res.headers['content-encoding'],
              maxBytes,
            );
            const outResHeaders = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (!DROP_RESPONSE_HEADERS.has(k) && v !== undefined) {
                outResHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
              }
            }
            resolve({ status: res.statusCode ?? 502, headers: outResHeaders, body: decoded });
          } catch {
            reject(new AppError('FETCH_FAILED', 'Response could not be decoded or was too large.'));
          }
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () =>
      req.destroy(new AppError('FETCH_FAILED', `No response within ${timeoutMs} ms.`)),
    );
    req.on('error', (err) =>
      reject(err instanceof AppError ? err : new AppError('FETCH_FAILED', err.message)),
    );
    if (body?.length) req.write(body);
    req.end();
  });
}
