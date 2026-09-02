'use strict';

const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const httpStatus = require('../constants/httpStatus');

const buckets = new Map();

function authRateLimit({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || 'unknown'}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    const active = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + windowMs };
    active.count += 1;
    buckets.set(key, active);
    if (active.count > max) {
      res.set('Retry-After', String(Math.ceil((active.resetAt - now) / 1000)));
      return next(
        new AppError(
          'Too many requests. Please try again later.',
          httpStatus.TOO_MANY_REQUESTS,
          errorCodes.RATE_LIMITED,
        ),
      );
    }
    return next();
  };
}

module.exports = { authRateLimit };
