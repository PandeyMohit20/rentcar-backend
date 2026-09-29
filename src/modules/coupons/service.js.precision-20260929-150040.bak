'use strict';

const { Prisma } = require('@prisma/client');

const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { CouponRepository } = require('./repository');

const notFound = () =>
  new AppError(
    'Coupon not found.',
    httpStatus.NOT_FOUND,
    errorCodes.RESOURCE_NOT_FOUND,
  );

const invalidCoupon = (message) =>
  new AppError(
    message,
    httpStatus.UNPROCESSABLE_ENTITY,
    errorCodes.VALIDATION_ERROR,
  );

const duplicate = () =>
  new AppError(
    'Coupon code already exists.',
    httpStatus.CONFLICT,
    errorCodes.DUPLICATE_RESOURCE,
  );

function decimal(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeCoupon(coupon) {
  if (!coupon) return null;

  return {
    ...coupon,
    discountValue: decimal(coupon.discountValue),
    minimumBookingAmount: decimal(coupon.minimumBookingAmount),
    maximumDiscount: decimal(coupon.maximumDiscount),
  };
}

function calculateDiscount(coupon, bookingAmount) {
  const amount = money(bookingAmount);

  let discount;

  if (coupon.discountType === 'percentage') {
    discount = money(
      (amount * decimal(coupon.discountValue)) / 100,
    );
  } else {
    discount = money(decimal(coupon.discountValue));
  }

  if (coupon.maximumDiscount !== null) {
    discount = Math.min(
      discount,
      decimal(coupon.maximumDiscount),
    );
  }

  return money(Math.min(discount, amount));
}

async function validateCouponForUser({
  code,
  bookingAmount,
  userId,
  db = prisma,
}) {
  const normalizedCode = String(code).trim().toUpperCase();

  const coupon = await CouponRepository.findByCode(
    normalizedCode,
    db,
  );

  if (!coupon) {
    throw invalidCoupon('Invalid coupon code.');
  }

  const normalized = normalizeCoupon(coupon);
  const now = new Date();

  if (normalized.status !== 'active') {
    throw invalidCoupon('Coupon is not active.');
  }

  if (
    normalized.startDate &&
    now < new Date(normalized.startDate)
  ) {
    throw invalidCoupon('Coupon is not active yet.');
  }

  if (
    normalized.endDate &&
    now > new Date(normalized.endDate)
  ) {
    throw invalidCoupon('Coupon has expired.');
  }

  const amount = money(bookingAmount);

  if (
    normalized.minimumBookingAmount !== null &&
    amount < normalized.minimumBookingAmount
  ) {
    throw invalidCoupon(
      `Minimum booking amount for this coupon is ${normalized.minimumBookingAmount}.`,
    );
  }

  const [totalUsage, userUsage] = await Promise.all([
    CouponRepository.usageCount(normalized.id, db),
    userId
      ? CouponRepository.userUsageCount(
          normalized.id,
          userId,
          db,
        )
      : Promise.resolve(0),
  ]);

  if (
    normalized.usageLimit !== null &&
    totalUsage >= normalized.usageLimit
  ) {
    throw invalidCoupon('Coupon usage limit has been reached.');
  }

  if (
    userId &&
    normalized.perUserLimit !== null &&
    userUsage >= normalized.perUserLimit
  ) {
    throw invalidCoupon(
      'You have already used this coupon the maximum number of times.',
    );
  }

  const discountAmount = calculateDiscount(
    normalized,
    amount,
  );

  if (discountAmount <= 0) {
    throw invalidCoupon(
      'Coupon does not provide a valid discount for this booking.',
    );
  }

  return {
    coupon: normalized,
    bookingAmount: amount,
    discountAmount,
    discountedAmount: money(amount - discountAmount),
    usage: {
      total: totalUsage,
      user: userUsage,
    },
  };
}

async function listCoupons(query) {
  const page = query.page || 1;
  const limit = query.limit || 20;

  const where = {
    isDeleted: false,
    ...(query.status
      ? { status: query.status }
      : {}),
    ...(query.search
      ? {
          code: {
            contains: query.search.toUpperCase(),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    CouponRepository.list(
      where,
      (page - 1) * limit,
      limit,
    ),
    CouponRepository.count(where),
  ]);

  return {
    data: rows.map(normalizeCoupon),
    meta: {
      page,
      limit,
      total,
      totalPages: total
        ? Math.ceil(total / limit)
        : 0,
    },
  };
}

async function getCoupon(id) {
  const coupon = await CouponRepository.findById(id);

  if (!coupon) throw notFound();

  const normalized = normalizeCoupon(coupon);

  const usageCount =
    await CouponRepository.usageCount(id);

  return {
    ...normalized,
    usageCount,
  };
}

function normalizeWriteData(data) {
  const result = { ...data };

  if (result.code) {
    result.code = result.code.trim().toUpperCase();
  }

  for (const key of [
    'discountValue',
    'minimumBookingAmount',
    'maximumDiscount',
  ]) {
    if (result[key] !== undefined) {
      result[key] =
        result[key] === null
          ? null
          : new Prisma.Decimal(result[key]);
    }
  }

  for (const key of ['startDate', 'endDate']) {
    if (result[key] !== undefined) {
      result[key] = result[key]
        ? new Date(result[key])
        : null;
    }
  }

  return result;
}

async function createCoupon(data) {
  try {
    const coupon = await CouponRepository.create(
      normalizeWriteData(data),
    );

    return normalizeCoupon(coupon);
  } catch (error) {
    if (error.code === 'P2002') throw duplicate();
    throw error;
  }
}

async function updateCoupon(id, data) {
  const current = await CouponRepository.findById(id);

  if (!current) throw notFound();

  const merged = {
    ...normalizeCoupon(current),
    ...data,
  };

  if (
    merged.discountType === 'percentage' &&
    Number(merged.discountValue) > 100
  ) {
    throw invalidCoupon(
      'Percentage discount cannot exceed 100.',
    );
  }

  if (
    merged.startDate &&
    merged.endDate &&
    new Date(merged.endDate) < new Date(merged.startDate)
  ) {
    throw invalidCoupon(
      'endDate must be on or after startDate.',
    );
  }

  const updated = await CouponRepository.update(
    id,
    normalizeWriteData(data),
  );

  return normalizeCoupon(updated);
}

async function deleteCoupon(id) {
  const current = await CouponRepository.findById(id);

  if (!current) throw notFound();

  await CouponRepository.update(id, {
    isDeleted: true,
    deletedAt: new Date(),
    status: 'disabled',
  });

  return {
    success: true,
  };
}

module.exports = {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponForUser,
  calculateDiscount,
  normalizeCoupon,
};
