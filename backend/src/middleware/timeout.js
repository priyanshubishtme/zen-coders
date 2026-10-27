import { AppError } from '../utils/errors.js';

/** Fail the request with SCAN_TIMEOUT if no response was sent in time. */
export function requestTimeout(ms) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) next(new AppError('SCAN_TIMEOUT', `Request exceeded ${ms} ms.`));
    }, ms);
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
