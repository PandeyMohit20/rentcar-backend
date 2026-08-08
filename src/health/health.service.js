'use strict';

const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const httpStatus = require('../constants/httpStatus');

/**
 * Health service — verifies application status and database connectivity.
 * Never exposes sensitive database information.
 */

function getAppHealth() {
  return {
    status: 'UP',
    service: 'rentcar-backend',
    timestamp: new Date().toISOString(),
  };
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'UP',
      connected: true,
      dialect: 'mysql',
    };
  } catch (err) {
    logger.error('Database health check failed', {
      requestId: undefined,
      code: 'DATABASE_UNAVAILABLE',
    });
    throw new AppError(
      'Database is unavailable.',
      httpStatus.SERVICE_UNAVAILABLE,
      errorCodes.DATABASE_UNAVAILABLE,
    );
  }
}

async function getDatabaseHealth() {
  const dbStatus = await checkDatabase();
  return dbStatus;
}

module.exports = { getAppHealth, checkDatabase, getDatabaseHealth };
