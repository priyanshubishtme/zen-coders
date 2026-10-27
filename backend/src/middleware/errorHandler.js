import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}.`));
}

// Express identifies error handlers by arity, so all four params must stay.
export function errorHandler(err, req, res, _next) {
  let appError = err instanceof AppError ? err : null;
  if (!appError && err?.type === 'entity.too.large') {
    appError = new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }
  if (!appError && err?.type === 'entity.parse.failed') {
    appError = new AppError('VALIDATION_ERROR', 'Request body is not valid JSON.');
  }
  if (!appError) {
    req.log?.error({ err }, 'unhandled error');
    appError = new AppError('INTERNAL', 'Something went wrong.');
  }
  if (appError.details?.retryAfterSec) res.set('Retry-After', String(appError.details.retryAfterSec));
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
      requestId: req.id,
    },
  });
}
