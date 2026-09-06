'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { controller } = require('./controller');
const schemas = require('./validator');

const adminBookingReadRouter = Router();
const vendorBookingReadRouter = Router();
const canViewBookings = [authenticate, authorize('bookings.view')];

adminBookingReadRouter.get(
  '/',
  ...canViewBookings,
  validate({ query: schemas.adminList }),
  controller.adminList,
);
adminBookingReadRouter.get(
  '/:bookingId',
  ...canViewBookings,
  validate({ params: schemas.bookingId }),
  controller.adminDetail,
);

vendorBookingReadRouter.get(
  '/',
  ...canViewBookings,
  validate({ query: schemas.vendorList }),
  controller.vendorList,
);
vendorBookingReadRouter.get(
  '/:bookingId',
  ...canViewBookings,
  validate({ params: schemas.bookingId }),
  controller.vendorDetail,
);

module.exports = { adminBookingReadRouter, vendorBookingReadRouter };
