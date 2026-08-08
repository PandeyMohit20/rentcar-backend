'use strict';

const { notFoundHandler } = require('../errors/notFoundHandler');

// Re-export the 404 handler as middleware.
module.exports = { notFoundHandler };
