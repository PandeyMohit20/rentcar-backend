'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { env } = require('./config/env');
const { corsOptions } = require('./config/cors');
const { logger } = require('./config/logger');
const { apiRouter, apiPrefix } = require('./routes');
const { requestId } = require('./middlewares/requestId');
const { notFoundHandler } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

/**
 * Express application factory.
 * Registers security middleware, parsers, compression, CORS, logging,
 * API routes, 404 handler, and the global error handler.
 * Does NOT start the HTTP server (that is server.js's job).
 */
function createApp() {
  const app = express();

  // Trust proxy for correct client IPs behind reverse proxies.
  app.set('trust proxy', 1);

  // Request ID must run first so all downstream logs have a requestId.
  app.use(requestId);

  // Security headers.
  app.use(helmet());

  // CORS (configured origins, credentials enabled).
  app.use(cors(corsOptions));

  // Request body parsing with size limits (1mb).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Cookie parsing.
  app.use(cookieParser());

  // Compression.
  app.use(compression());

  // Request logging (structured, safe — never logs sensitive data).
  if (env.LOG_LEVEL !== 'silent') {
    app.use(
      morgan(
        (tokens, req, res) => {
          return (
            `[HTTP] requestId=${req.requestId} method=${tokens.method(req, res)} ` +
            `path=${tokens.url(req, res)} status=${tokens.status(req, res)} ` +
            `duration=${tokens['response-time'](req, res)}ms`
          );
        },
        { skip: (req, res) => res.statusCode < 400 },
      ),
    );
  }
  // Log all requests via our structured logger in development.
  if (env.isDevelopment && env.LOG_LEVEL !== 'silent') {
    app.use((req, res, next) => {
      res.on('finish', () => {
        logger.info('request', {
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
        });
      });
      next();
    });
  }

  // API routes under /api/v1.
  app.use(apiPrefix, apiRouter);

  // 404 handler.
  app.use(notFoundHandler);

  // Global error handler (last).
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
