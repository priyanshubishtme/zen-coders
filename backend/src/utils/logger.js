import pino from 'pino';

/** @param {{ LOG_LEVEL: string, NODE_ENV: string }} config */
export function createLogger(config) {
  return pino({
    level: config.NODE_ENV === 'test' ? 'silent' : config.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
}
