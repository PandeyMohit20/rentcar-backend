'use strict';

const { env } = require('./env');

/**
 * CORS configuration.
 * Supports comma-separated origins from CORS_ORIGIN.
 * Multiple origins are supported (development, staging, production).
 * Never uses Access-Control-Allow-Origin: * when credentials are enabled.
 */

const parseOrigins = (value) =>
  value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const allowedOrigins = parseOrigins(env.CORS_ORIGIN);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (same-origin, server-to-server, tools).
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24h preflight cache
};

module.exports = { corsOptions, allowedOrigins };
