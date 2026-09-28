'use strict';

const { z } = require('zod');

const discountTypes = ['percentage', 'fixed'];
const statuses = ['active', 'inactive', 'expired', 'disabled'];

const money = z.coerce.number().finite().min(0);
const positiveMoney = z.coerce.number().finite().positive();

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .optional()
  .nullable();

const code = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Coupon code may contain only letters, numbers, hyphens and underscores.',
  )
  .transform((value) => value.toUpperCase());

const base = z
  .object({
    code,
    discountType: z.enum(discountTypes),
    discountValue: positiveMoney,
    minimumBookingAmount: money.optional().nullable(),
    maximumDiscount: positiveMoney.optional().nullable(),
    startDate: optionalDate,
    endDate: optionalDate,
    usageLimit: z.coerce.number().int().positive().optional().nullable(),
    perUserLimit: z.coerce.number().int().positive().optional().nullable(),
    status: z.enum(statuses).optional(),
  })
  .strict();

function validateBusinessRules(data, ctx) {
  if (
    data.discountType === 'percentage' &&
    Number(data.discountValue) > 100
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Percentage discount cannot exceed 100.',
    });
  }

  if (
    data.startDate &&
    data.endDate &&
    new Date(data.endDate) < new Date(data.startDate)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'endDate must be on or after startDate.',
    });
  }
}

const create = base.superRefine(validateBusinessRules);

const update = base
  .partial()
  .omit({ code: true })
  .strict()
  .superRefine(validateBusinessRules);

const list = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(statuses).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();

const couponId = z
  .object({
    couponId: z.string().uuid(),
  })
  .strict();

const validateCoupon = z
  .object({
    code,
    bookingAmount: positiveMoney,
  })
  .strict();

module.exports = {
  create,
  update,
  list,
  couponId,
  validateCoupon,
};
