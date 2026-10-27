import { AppError } from '../utils/errors.js';

/**
 * Validate and replace req.body / req.params / req.query with parsed values.
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          path: [part, ...i.path].join('.'),
          message: i.message,
        }));
        return next(new AppError('VALIDATION_ERROR', `Invalid request ${part}.`, details));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
