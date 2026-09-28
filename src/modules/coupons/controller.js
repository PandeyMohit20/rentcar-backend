'use strict';

const { success, created } = require('../../utils/response');
const {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponForUser,
} = require('./service');

const CouponController = {
  async list(req, res, next) {
    try {
      const result = await listCoupons(req.query);

      return success(res, {
        message: 'Coupons fetched successfully.',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  },

  async get(req, res, next) {
    try {
      return success(res, {
        message: 'Coupon fetched successfully.',
        data: await getCoupon(req.params.couponId),
      });
    } catch (error) {
      return next(error);
    }
  },

  async create(req, res, next) {
    try {
      return created(res, {
        message: 'Coupon created successfully.',
        data: await createCoupon(req.body),
      });
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      return success(res, {
        message: 'Coupon updated successfully.',
        data: await updateCoupon(
          req.params.couponId,
          req.body,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      return success(res, {
        message: 'Coupon deleted successfully.',
        data: await deleteCoupon(
          req.params.couponId,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async validate(req, res, next) {
    try {
      const result = await validateCouponForUser({
        code: req.body.code,
        bookingAmount: req.body.bookingAmount,
        userId: req.user.sub,
      });

      return success(res, {
        message: 'Coupon is valid.',
        data: {
          valid: true,
          coupon: {
            id: result.coupon.id,
            code: result.coupon.code,
            discountType:
              result.coupon.discountType,
            discountValue:
              result.coupon.discountValue,
            maximumDiscount:
              result.coupon.maximumDiscount,
          },
          bookingAmount: result.bookingAmount,
          discountAmount: result.discountAmount,
          discountedAmount:
            result.discountedAmount,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = { CouponController };
