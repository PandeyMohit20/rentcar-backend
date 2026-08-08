'use strict';

const { errorHandler } = require('../errors/errorHandler');

// Re-export the global error handler as middleware.
module.exports = { errorHandler };
