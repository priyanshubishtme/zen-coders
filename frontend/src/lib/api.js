/**
 * API client. Shapes mirror backend/src/schemas (see docs/04-api-contract.md).
 *
 * @typedef {'critical' | 'serious' | 'moderate' | 'minor'} Impact
 * @typedef {{ status: 'ok' | 'degraded', version: string, uptimeSec: number,
 *   checks: { browser: 'up' | 'down' | 'unknown', store: 'memory' | 'mongo',
 *   llm: 'off' | 'on' | 'circuit-open' } }} Health
 * @typedef {{ error: { code: string, message: string, details?: unknown, requestId?: string } }} ErrorBody
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed with ${status}`);
    this.status = status;
    this.code = body?.error?.code ?? 'NETWORK';
  }
}

async function request(path, init) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** @returns {Promise<Health>} */
export const getHealth = () => request('/health');
