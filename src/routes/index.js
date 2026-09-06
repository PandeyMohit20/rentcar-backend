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
const { vendorsRouter } = require('../modules/vendors/routes');
const { locationsRouter } = require('../modules/locations/routes');
const { carsRouter } = require('../modules/cars/routes');
const { fleetRouter } = require('../modules/fleet/routes');
const { availabilityRouter } = require('../modules/availability/routes');
const { pricingRouter } = require('../modules/pricing/routes');
const { bookingsRouter } = require('../modules/bookings/routes');
const { paymentsRouter } = require('../modules/payments/routes');
const { refundsRouter } = require('../modules/refunds/routes');
const { RefundsController } = require('../modules/refunds/controller');
const refundSchemas = require('../modules/refunds/validator');
const { authenticate } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { invoicesRouter } = require('../modules/invoices/routes');
const { InvoicesController } = require('../modules/invoices/controller');
const invoiceSchemas = require('../modules/invoices/validator');
const { kycRouter } = require('../modules/kyc/routes');
const { adminKycRouter } = require('../modules/adminKyc/routes');
const {
  adminBookingReadRouter,
  vendorBookingReadRouter,
} = require('../modules/bookingReads/routes');

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
router.use('/vendors', vendorsRouter);
router.use('/locations', locationsRouter);
router.use('/cars', carsRouter);
router.use('/fleet', fleetRouter);
router.use('/availability', availabilityRouter);
router.use('/pricing', pricingRouter);
router.use('/bookings', bookingsRouter);
router.use('/payments', paymentsRouter);
router.use('/refunds', refundsRouter);
router.use('/invoices', invoicesRouter);
router.use('/kyc', kycRouter);
router.use('/admin/kyc', adminKycRouter);
router.use('/admin/bookings', adminBookingReadRouter);
router.use('/vendor/bookings', vendorBookingReadRouter);
router.get('/bookings/:bookingId/refunds', authenticate, validate({ params: refundSchemas.bookingId }), RefundsController.listForBooking);
router.get('/bookings/:bookingId/invoice', authenticate, validate({ params: invoiceSchemas.bookingId }), InvoicesController.getForBooking);

// Future modules — 501 Not Implemented placeholders.
// Business logic for these belongs to later phases.
const futureModules = [
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
