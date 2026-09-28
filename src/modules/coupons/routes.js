'use strict';

const { Router } = require('express');

const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { CouponController } = require('./controller');
const schemas = require('./validator');

const router = Router();

/*
 * Customer coupon validation.
 *
 * The customer supplies only the coupon code and booking amount
 * for preview purposes. Final pricing will still be recalculated
 * by the trusted pricing quote flow.
 */
router.post(
  '/validate',
  authenticate,
  validate({ body: schemas.validateCoupon }),
  CouponController.validate,
);

/*
 * Admin coupon management.
 */
router.get(
  '/',
  authenticate,
  authorize('coupons.view'),
  validate({ query: schemas.list }),
  CouponController.list,
);

router.post(
  '/',
  authenticate,
  authorize('coupons.create'),
  validate({ body: schemas.create }),
  CouponController.create,
);

router.get(
  '/:couponId',
  authenticate,
  authorize('coupons.view'),
  validate({ params: schemas.couponId }),
  CouponController.get,
);

router.patch(
  '/:couponId',
  authenticate,
  authorize('coupons.update'),
  validate({
    params: schemas.couponId,
    body: schemas.update,
  }),
  CouponController.update,
);

router.delete(
  '/:couponId',
  authenticate,
  authorize('coupons.delete'),
  validate({ params: schemas.couponId }),
  CouponController.remove,
);

module.exports = {
  couponRouter: router,
};
