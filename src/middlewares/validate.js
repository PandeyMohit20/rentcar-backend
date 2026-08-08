'use strict';

const { z } = require('zod');

/**
 * Validation middleware using Zod.
 * Supports validating body, params, query, and headers.
 * Returns standardized validation errors.
 *
 * Usage:
 *   validate({ body: z.object({...}) })
 *   validate({ params: z.object({ id: z.string().uuid() }) })
 */
function validate(schemas = {}) {
  return (req, res, next) => {
    const targets = ['body', 'params', 'query', 'headers'];
    try {
      for (const target of targets) {
        if (schemas[target]) {
          const result = schemas[target].safeParse(req[target]);
          if (!result.success) {
            const err = new Error('Validation failed.');
            err.name = 'ZodError';
            err.issues = result.error.issues;
            err.statusCode = 422;
            return next(err);
          }
          // Replace parsed (possibly coerced) values back on the request.
          req[target] = result.data;
        }
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { validate, z };
