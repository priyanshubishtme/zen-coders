import { rateLimit } from 'express-rate-limit';

/** Per-IP request limit with the standard error envelope. */
export function createRateLimiter(rpm) {
  return rateLimit({
    windowMs: 60_000,
    limit: rpm,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again shortly.',
          requestId: req.id,
        },
      });
    },
  });
}
