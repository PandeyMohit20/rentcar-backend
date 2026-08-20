'use strict';

const { Router } = require('express');
const { env } = require('../config/env');
const { healthRouter } = require('../health/health.routes');
const { authRouter } = require('../modules/auth/routes');
const { usersRouter } = require('../modules/users/routes');
const { profilesRouter } = require('../modules/profiles/routes');
const { addressesRouter } = require('../modules/addresses/routes');
const { notImplementedRouter } = require('./notImplemented');
const { rolesRouter } = require('../modules/roles/routes');

const router = Router();

// Mount health routes (real implementation).
router.use('/health', healthRouter);

// Mount auth module (Phases 19-20).
router.use('/auth', authRouter);

// Mount users module (Phase 21 — user, profile, address, account management).
router.use('/users', usersRouter);
router.use('/profiles', profilesRouter);
router.use('/addresses', addressesRouter);
router.use('/roles', rolesRouter);

// Future modules — 501 Not Implemented placeholders.
// Business logic for these belongs to later phases.
const futureModules = [
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
