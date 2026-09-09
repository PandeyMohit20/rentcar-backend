'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { controller } = require('./controller');
const schemas = require('./validator');

const adminBookingReadRouter = Router();
const vendorBookingReadRouter = Router();
adminBookingReadRouter.get('/:bookingId/invoice/download', authenticate, authorize('bookings.view'), validate({ params: schemas.bookingId }), (req, res, next) => { req.invoiceAdmin = true; return require('../invoices/controller').InvoicesController.download(req, res, next); });
adminBookingReadRouter.get('/:bookingId/emails', authenticate, authorize('bookings.view'), validate({ params: schemas.bookingId }), async (req, res, next) => { try {
 const data = await require('../../config/database').prisma.emailDelivery.findMany({ where: { bookingId: req.params.bookingId }, select: { id: true, eventType: true, status: true, attempts: true, acceptedAt: true, lastErrorCode: true }, orderBy: { createdAt: 'asc' } });
 return require('../../utils/response').success(res, { data });
} catch (err) { next(err); } });
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
