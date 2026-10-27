import { AppError } from '../utils/errors.js';
import { readCookie } from '../utils/cookies.js';

/**
 * Custom header plus Origin, but only when a session cookie is already present.
 * Requests with no cookie (the existing API tests, and anonymous scans) are unchanged.
 */
export function csrfGuard(config) {
  const allowed = new Set(config.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));
  return (req, _res, next) => {
    if (!readCookie(req.headers.cookie, 'accessfix.sid')) return next();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (req.get('x-accessfix-request') !== '1') {
      return next(new AppError('CSRF', 'This request was rejected. Refresh the page and try again.'));
    }
    const origin = req.get('origin');
    if (!origin || !allowed.has(origin)) {
      return next(new AppError('CSRF', 'This request was rejected. Refresh the page and try again.'));
    }
    return next();
  };
}
