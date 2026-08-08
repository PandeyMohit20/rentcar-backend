'use strict';

const { Router } = require('express');
const httpStatus = require('../constants/httpStatus');
const errorCodes = require('../errors/errorCodes');

/**
 * Returns a router that responds 501 Not Implemented for all methods.
 * Used for modules whose business logic belongs to future phases.
 * This intentionally does NOT fake completed functionality.
 */
function notImplementedRouter(moduleName) {
  const router = Router();

  const handler = (req, res) => {
    res.status(httpStatus.NOT_IMPLEMENTED).json({
      success: false,
      message: `${moduleName} module is not implemented yet.`,
      error: {
        code: errorCodes.NOT_IMPLEMENTED,
        details: {
          module: moduleName,
          method: req.method,
          path: req.originalUrl,
        },
      },
    });
  };

  router.all('/', handler);
  router.all('*', handler);

  return router;
}

module.exports = { notImplementedRouter };
