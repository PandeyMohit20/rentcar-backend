'use strict';

const httpStatus = require('../constants/httpStatus');

/**
 * Custom application error.
 * All expected/operational errors thrown by the application should extend
 * or use this class. Unexpected errors (bugs) are NOT operational.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} statusCode - HTTP status code.
   * @param {string} [code] - Canonical error code from errorCodes.
   * @param {object} [details] - Additional structured details.
   */
  constructor(message, statusCode = httpStatus.INTERNAL_SERVER_ERROR, code, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
