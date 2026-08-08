'use strict';

const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const httpStatus = require('../constants/httpStatus');
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Authentication middleware foundation.
 * Reads `Authorization: Bearer <token>`, verifies the access token,
 * and attaches the authenticated user payload to req.user.
 *
 * Full login logic is implemented in later phases (auth module).
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(
      new AppError(
        'Authentication required. Provide a Bearer token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.UNAUTHORIZED,
      ),
    );
  }

  const token = header.slice(7).trim();
  if (!token) {
    return next(
      new AppError(
        'Authentication required. Provide a valid token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.UNAUTHORIZED,
      ),
    );
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    req.token = token;
    return next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return next(
      new AppError(
        isExpired ? 'Token has expired.' : 'Invalid or expired token.',
        httpStatus.UNAUTHORIZED,
        isExpired ? errorCodes.TOKEN_EXPIRED : errorCodes.INVALID_TOKEN,
      ),
    );
  }
}

module.exports = { authenticate };
