'use strict';

const httpStatus = require('../constants/httpStatus');
const errorCodes = require('./errorCodes');

/**
 * 404 handler for unknown routes.
 * Returns the standard API error response.
 */
function notFoundHandler(req, res) {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
    error: {
      code: errorCodes.ROUTE_NOT_FOUND,
      details: {
        method: req.method,
        path: req.originalUrl,
      },
    },
  });
}

module.exports = { notFoundHandler };
