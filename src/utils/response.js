'use strict';

/**
 * Standardized API response helpers.
 * Success:  { success, message, data, meta }
 * Error:    { success, message, error: { code, details } }
 */

function success(res, { statusCode = 200, message = 'Request successful', data = {}, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, { message = 'Resource created', data = {} } = {}) {
  return success(res, { statusCode: 201, message, data });
}

function noContent(res, { message = 'Success' } = {}) {
  return res.status(204).json({ success: true, message, data: {} });
}

module.exports = { success, created, noContent };
