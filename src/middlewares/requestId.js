'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Request ID middleware.
 * Generates a UUID for every request and exposes it via the
 * X-Request-ID response header and req.requestId for logging.
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = { requestId };
