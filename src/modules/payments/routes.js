'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { PaymentsController } = require('./controller');
const schemas = require('./validator');
const router = Router();

// ============================================================
// ADMIN PAYMENT READ APIs
// ============================================================

router.get(
  '/admin',
  authenticate,
  authorize('payments.view'),
  validate({
    query: schemas.adminList,
  }),
  PaymentsController.adminList,
);

router.get(
  '/admin/:paymentId',
  authenticate,
  authorize('payments.view'),
  validate({
    params: schemas.adminPaymentId,
  }),
  PaymentsController.adminGet,
);

// ============================================================
// CUSTOMER PAYMENT APIs
// ============================================================

router.post(
  '/orders',
  authenticate,
  validate({ body: schemas.order }),
  PaymentsController.createOrder,
);

router.post(
  '/:bookingId/reconcile',
  authenticate,
  validate({
    params: require('zod')
      .z.object({ bookingId: require('zod').z.string().uuid() })
      .strict(),
    body: require('zod').z.object({}).strict(),
  }),
  async (req, res, next) => {
    try {
      const data = await require('./reconciliation').reconcile({
        userId: req.user.sub,
        bookingId: req.params.bookingId,
      });

      return require('../../utils/response').success(res, {
        message: 'Provider payment state checked.',
        data,
      });
    } catch (err) {
      if (err.statusCode === 429) res.set('Retry-After', '30');
      return next(err);
    }
  },
);

router.post(
  '/verify',
  authenticate,
  validate({ body: schemas.verify }),
  PaymentsController.verify,
);

router.post(
  '/webhook/razorpay',
  PaymentsController.webhook,
);

router.get(
  '/:paymentId',
  authenticate,
  validate({ params: schemas.paymentId }),
  PaymentsController.get,
);

module.exports = { paymentsRouter: router };
