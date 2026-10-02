'use strict';

const { Router } = require('express');
const { env } = require('../config/env');

const { healthRouter } = require('../health/health.routes');

const { authRouter } = require('../modules/auth/routes');
const { usersRouter } = require('../modules/users/routes');
const { profilesRouter } = require('../modules/profiles/routes');
const { addressesRouter } = require('../modules/addresses/routes');
const { rolesRouter } = require('../modules/roles/routes');

const { vendorsRouter } = require('../modules/vendors/routes');
const { locationsRouter } = require('../modules/locations/routes');
const { carsRouter } = require('../modules/cars/routes');
const { fleetRouter } = require('../modules/fleet/routes');

const { availabilityRouter } = require('../modules/availability/routes');
const { pricingRouter } = require('../modules/pricing/routes');

const { billingApprovalRouter } = require('../modules/billingApproval/routes');

const { bookingsRouter } = require('../modules/bookings/routes');
const { paymentsRouter } = require('../modules/payments/routes');

const { analyticsRouter } = require('../modules/analytics/routes');
const { reportsRouter } = require('../modules/reports/routes');

const { inventoryRouter } = require('../modules/inventory/routes');
const { blackoutRouter } = require('../modules/inventory/blackout.routes');
const { transferRouter } = require('../modules/inventory/transfer.routes');

const { utilizationRouter } = require('../modules/utilization/routes');

const { couponRouter } = require('../modules/coupons/routes');
const { walletRouter } = require('../modules/wallet/routes');
const { refundsRouter } = require('../modules/refunds/routes');

const { RefundsController } = require('../modules/refunds/controller');
const refundSchemas = require('../modules/refunds/validator');

const { invoicesRouter } = require('../modules/invoices/routes');
const { InvoicesController } = require('../modules/invoices/controller');
const invoiceSchemas = require('../modules/invoices/validator');

const { kycRouter } = require('../modules/kyc/routes');
const { adminKycRouter } = require('../modules/adminKyc/routes');

const {
  adminBookingReadRouter,
  vendorBookingReadRouter,
} = require('../modules/bookingReads/routes');

const { notImplementedRouter } = require('./notImplemented');

const { authenticate } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');

const router = Router();

// ========================================================
// HEALTH
// ========================================================

router.use('/health', healthRouter);

// ========================================================
// AUTH & USER MANAGEMENT
// ========================================================

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/profiles', profilesRouter);
router.use('/addresses', addressesRouter);
router.use('/roles', rolesRouter);

// ========================================================
// VENDOR / LOCATION / FLEET
// ========================================================

router.use('/vendors', vendorsRouter);
router.use('/locations', locationsRouter);
router.use('/cars', carsRouter);
router.use('/fleet', fleetRouter);

// ========================================================
// INVENTORY
// ========================================================

router.use('/availability', availabilityRouter);
router.use('/inventory', inventoryRouter);
router.use('/blackouts', blackoutRouter);
router.use('/transfers', transferRouter);
router.use('/utilization', utilizationRouter);

// ========================================================
// PRICING
// ========================================================

router.use('/pricing', pricingRouter);

// ========================================================
// BILLING
// ========================================================

router.use('/admin/billing-approval', billingApprovalRouter);

// ========================================================
// BOOKINGS & PAYMENTS
// ========================================================

router.use('/bookings', bookingsRouter);
router.use('/payments', paymentsRouter);

// ========================================================
// ANALYTICS & REPORTS
// ========================================================

router.use('/analytics', analyticsRouter);
router.use('/reports', reportsRouter);

// ========================================================
// OTHER MODULES
// ========================================================

router.use('/coupons', couponRouter);
router.use('/wallet', walletRouter);
router.use('/refunds', refundsRouter);
router.use('/invoices', invoicesRouter);

// ========================================================
// KYC
// ========================================================

router.use('/kyc', kycRouter);
router.use('/admin/kyc', adminKycRouter);

// ========================================================
// BOOKING READ ROUTES
// ========================================================

router.use('/admin/bookings', adminBookingReadRouter);
router.use('/vendor/bookings', vendorBookingReadRouter);

// ========================================================
// REFUND ROUTES
// ========================================================

router.get(
  '/bookings/:bookingId/refunds',
  authenticate,
  validate({
    params: refundSchemas.bookingId,
  }),
  RefundsController.listForBooking,
);

// ========================================================
// INVOICE ROUTES
// ========================================================

router.get(
  '/bookings/:bookingId/invoice/download',
  authenticate,
  validate({
    params: invoiceSchemas.bookingId,
  }),
  InvoicesController.download,
);

router.get(
  '/bookings/:bookingId/invoice',
  authenticate,
  validate({
    params: invoiceSchemas.bookingId,
  }),
  InvoicesController.getForBooking,
);

const futureModules = [
  'coupons',
  'notifications',
  'support',
  'admin',
];

for (const moduleName of futureModules) {
  router.use(
    `/${moduleName}`,
    notImplementedRouter(moduleName),
  );
}

const { reviewsRouter } = require('../modules/reviews/routes');
router.use('/reviews', reviewsRouter);

// ========================================================
// EXPORT
// ========================================================

module.exports = {
  apiRouter: router,
  apiPrefix: env.API_PREFIX,
};

