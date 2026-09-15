'use strict';

const http = require('http');
const { env, isProduction } = require('./config/env');
const { prisma } = require('./config/database');
const { logger } = require('./config/logger');
const { createApp } = require('./app');

/**
 * Application entry point.
 * 1. Load env (done at require time via env.js)
 * 2. Initialize Prisma
 * 3. Create HTTP server
 * 4. Listen on PORT
 * 5. Handle graceful shutdown (SIGTERM/SIGINT, DB disconnect)
 */

let server;

async function start() {
  const app = createApp();
  server = http.createServer(app);

  // Connect to the database (Prisma connects lazily, but explicit connect
  // surfaces startup errors early). In test-mock mode this is a no-op.
  try {
    await prisma.$connect();
    logger.info('Database connected');
    if (require('./config/uatTax').isUatTaxBypass()) logger.warn('WARNING: TAX APPROVAL UAT BYPASS ACTIVE');
  } catch (err) {
    logger.error('Database connection failed', { code: 'DATABASE_CONNECT_FAILED' });
    // Do not exit in test-mock; but in real modes fail fast.
    if (!env.TEST_DATABASE_MOCK) {
      throw err;
    }
  }

  server.listen(env.PORT, () => {
    logger.info(
      `RentCar API started (${env.NODE_ENV}) on http://localhost:${env.PORT}${env.API_PREFIX}`,
    );
  });
}

/**
 * Graceful shutdown.
 * Closes the HTTP server, disconnects Prisma, then exits.
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      try {
        await prisma.$disconnect();
        logger.info('Database disconnected');
      } finally {
        process.exit(0);
      }
    });
    // Force-exit if connections do not close within 10s.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  } else {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error('Failed to start server', {
    code: 'SERVER_START_FAILED',
    stack: isProduction ? undefined : err.stack,
  });
  process.exit(1);
});
