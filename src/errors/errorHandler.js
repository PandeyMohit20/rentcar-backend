'use strict';

const httpStatus = require('../constants/httpStatus');
const errorCodes = require('./errorCodes');
const { logger } = require('../config/logger');

/**
 * Maps known Prisma error codes to safe HTTP responses.
 * Raw Prisma messages are never exposed to clients.
 */
const PRISMA_ERROR_MAP = {
  P2002: {
    statusCode: httpStatus.CONFLICT,
    code: errorCodes.DUPLICATE_RESOURCE,
    message: 'A record with the same unique value already exists.',
  },
  P2025: {
    statusCode: httpStatus.NOT_FOUND,
    code: errorCodes.RESOURCE_NOT_FOUND,
    message: 'The requested resource was not found.',
  },
  P2003: {
    statusCode: httpStatus.CONFLICT,
    code: errorCodes.FOREIGN_KEY_VIOLATION,
    message: 'The operation violates a referential constraint.',
  },
  P2000: {
    statusCode: httpStatus.UNPROCESSABLE_ENTITY,
    code: errorCodes.UNPROCESSABLE_ENTITY,
    message: 'The provided value is too long for the column.',
  },
  P2014: {
    statusCode: httpStatus.CONFLICT,
    code: errorCodes.CONFLICT,
    message: 'The operation would violate a required relation.',
  },
  P2001: {
    statusCode: httpStatus.NOT_FOUND,
    code: errorCodes.RESOURCE_NOT_FOUND,
    message: 'The requested record does not exist.',
  },
};

const isPrismaError = (err) => err && typeof err.code === 'string' && /^P\d{4}$/.test(err.code);

/**
 * Global error handler.
 * Must be the last middleware in the app.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Something went wrong';
  let code = err.code || errorCodes.INTERNAL_ERROR;
  let details = err.details;

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Uploaded file exceeds the allowed size limit.';
  }

  // Prisma known errors
  if (isPrismaError(err)) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (mapped) {
      statusCode = mapped.statusCode;
      code = mapped.code;
      message = mapped.message;
      details = undefined;
    } else {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      code = errorCodes.DATABASE_ERROR;
      message = 'A database error occurred.';
    }
  }

  // Zod validation errors bubbled by the validation middleware
  if (err.name === 'ZodError') {
    statusCode = httpStatus.UNPROCESSABLE_ENTITY;
    code = errorCodes.VALIDATION_ERROR;
    message = 'Validation failed.';
    details = { issues: err.issues };
  }

  // Log unexpected errors (safely). Never log secrets.
  if (!err.isOperational || statusCode >= 500) {
    logger.error('Unhandled error', {
      requestId: req.requestId,
      code,
      statusCode,
      stack: err.stack,
    });
  }

  // Server failures must be customer-safe in every environment, including UAT.
  if (statusCode >= 500) {
    message = 'The service is temporarily unavailable. Please try again shortly.';
    code = errorCodes.INTERNAL_ERROR;
    details = undefined;
  }

  const response = {
    success: false,
    message,
    error: {
      code,
    },
  };
  if (details) response.error.details = details;

  // Stack traces belong in server-side diagnostics, never API responses.
  // Development APIs are also consumed by browsers and integration clients.

  res.status(statusCode).json(response);
}

module.exports = { errorHandler, isPrismaError, PRISMA_ERROR_MAP };
