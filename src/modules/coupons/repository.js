'use strict';

const { prisma } = require('../../config/database');

const couponSelect = {
  id: true,
  code: true,
  discountType: true,
  discountValue: true,
  minimumBookingAmount: true,
  maximumDiscount: true,
  startDate: true,
  endDate: true,
  usageLimit: true,
  perUserLimit: true,
  status: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const CouponRepository = {
  findById(id, db = prisma) {
    return db.coupon.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: couponSelect,
    });
  },

  findByCode(code, db = prisma) {
    return db.coupon.findFirst({
      where: {
        code,
        isDeleted: false,
      },
      select: couponSelect,
    });
  },

  count(where, db = prisma) {
    return db.coupon.count({ where });
  },

  list(where, skip, take, db = prisma) {
    return db.coupon.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }],
      select: couponSelect,
    });
  },

  create(data, db = prisma) {
    return db.coupon.create({
      data,
      select: couponSelect,
    });
  },

  update(id, data, db = prisma) {
    return db.coupon.update({
      where: { id },
      data,
      select: couponSelect,
    });
  },

  usageCount(couponId, db = prisma) {
    return db.couponUsage.count({
      where: { couponId },
    });
  },

  userUsageCount(couponId, userId, db = prisma) {
    return db.couponUsage.count({
      where: {
        couponId,
        userId,
      },
    });
  },
};

module.exports = {
  CouponRepository,
  couponSelect,
};
