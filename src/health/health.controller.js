'use strict';

const { getAppHealth, getDatabaseHealth } = require('./health.service');
const { success } = require('../utils/response');

/**
 * Handlers are thin: receive request -> call service -> return response.
 * No business logic or Prisma queries here.
 */
async function health(req, res, next) {
  try {
    return success(res, {
      message: 'RentCar API is healthy',
      data: getAppHealth(),
    });
  } catch (err) {
    return next(err);
  }
}

async function databaseHealth(req, res, next) {
  try {
    const data = await getDatabaseHealth();
    return success(res, {
      message: 'Database is healthy',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { health, databaseHealth };
