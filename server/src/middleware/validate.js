import ApiError from '../utils/ApiError.js';

const PARTS = ['params', 'query', 'body'];

/**
 * validate({ body, params, query }) — each value is a zod schema.
 * On success the parsed (and stripped/coerced) data replaces req.body,
 * req.params and req.query, so handlers only ever see validated input.
 */
export const validate = (schemas) => (req, _res, next) => {
  const errors = [];

  for (const part of PARTS) {
    if (!schemas[part]) continue;

    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      errors.push(
        ...result.error.issues.map((i) => ({
          field: [part, ...i.path].join('.'),
          message: i.message,
        }))
      );
      continue;
    }

    // req.query is a getter in Express 5, so redefine it instead of assigning
    Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
  }

  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
  next();
};
