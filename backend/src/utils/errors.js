/**
 * Error model. Every error that reaches the client is an AppError with a
 * stable machine-readable code. See docs/03-architecture.md#error-model.
 */
export const ErrorCodes = Object.freeze({
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  CSRF: 403,
  NOT_FOUND: 404,
  SCAN_NOT_READY: 409,
  SOURCE_EXPIRED: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_INPUT: 422,
  URL_BLOCKED: 422,
  FETCH_FAILED: 502,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  NOT_IMPLEMENTED: 501,
  BROWSER_UNAVAILABLE: 503,
  SCANNER_BUSY: 503,
  SCAN_TIMEOUT: 504,
});

export class AppError extends Error {
  /**
   * @param {keyof typeof ErrorCodes} code
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ErrorCodes[code] ?? 500;
    this.details = details;
  }
}

export class NotImplementedError extends AppError {
  /** @param {string} what */
  constructor(what) {
    super('NOT_IMPLEMENTED', `${what} is not implemented yet.`);
    this.name = 'NotImplementedError';
  }
}
