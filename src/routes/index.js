'use strict';

const { Router } = require('express');
const { env } = require('../config/env');
const { healthRouter } = require('../health/health.routes');
const { authRouter } = require('../modules/auth/routes');
const { notImplementedRouter } = require('./notImplemented');

const router = Router();

// Mount health routes (real implementation).
router.use('/health', healthRouter);

// Mount auth module (foundation only in Phase 19).
router.use('/auth', authRouter);

// Future modules — 501 Not Implemented placeholders.
// Business logic for these belongs to later phases.
const futureModules = [
  'users',
  'vendors',
  'cars',
  'bookings',
  'payments',
  'wallet',
  'coupons',
  'reviews',
  'notifications',
  'support',
  'admin',
];

for (const moduleName of futureModules) {
  router.use(`/${moduleName}`, notImplementedRouter(moduleName));
}

module.exports = { apiRouter: router, apiPrefix: env.API_PREFIX };
