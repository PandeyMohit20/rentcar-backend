'use strict';

const { env } = require('./env');

/**
 * Structured logging foundation.
 * Provides a minimal, dependency-free logger that supports levels and
 * request-scoped context (requestId).
 *
 * Production safety: sensitive fields (passwords, tokens, OTP, bank details,
 * payment secrets, authorization headers) must never be logged.
 */

const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const level = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

const formatValue = (value) => {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

function log(levelName, message, meta) {
  if (LEVELS[levelName] > level) return;
  const timestamp = new Date().toISOString();
  const requestId = meta && meta.requestId ? ` [${meta.requestId}]` : '';
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] [${levelName.toUpperCase()}]${requestId} ${message}`);
  if (meta && Object.keys(meta).length > 0) {
    const rest = { ...meta };
    delete rest.requestId;
    if (Object.keys(rest).length > 0) {
      // eslint-disable-next-line no-console
      console.log(`    ${formatValue(rest)}`);
    }
  }
}

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};

module.exports = { logger };
