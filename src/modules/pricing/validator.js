'use strict';
const { z } = require('zod');
const statuses = ['active', 'inactive', 'pending', 'suspended', 'archived', 'rejected'];
const dateTime = z.string().datetime({ offset: true });
const rate = z.coerce.number().finite().min(0);
const base = z.object({ hourlyPrice: rate.optional().nullable(), dailyPrice: rate, weeklyPrice: rate.optional().nullable(), monthlyPrice: rate.optional().nullable(), extraHourPrice: rate.optional().nullable(), extraKmPrice: rate.optional().nullable(), securityDeposit: rate.optional().nullable(), currencyCode: z.string().trim().regex(/^[A-Z]{3}$/).optional(), effectiveFrom: dateTime.optional().nullable(), effectiveTo: dateTime.optional().nullable(), status: z.enum(statuses).optional() }).strict();
const dates = (schema) => schema.refine((value) => !value.effectiveFrom || !value.effectiveTo || new Date(value.effectiveTo) >= new Date(value.effectiveFrom), { message: 'effectiveTo must be on or after effectiveFrom.', path: ['effectiveTo'] });
const couponCode = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Coupon code may contain only letters, numbers, hyphens and underscores.',
  )
  .transform((value) => value.toUpperCase());

const quote = z
  .object({
    carId: z.string().uuid(),
    pickupDateTime: dateTime,
    returnDateTime: dateTime,
    couponCode: couponCode.optional(),
  })
  .strict()
  .refine(
    (value) =>
      new Date(value.returnDateTime) >
      new Date(value.pickupDateTime),
    {
      message:
        'returnDateTime must be after pickupDateTime.',
      path: ['returnDateTime'],
    },
  );
module.exports = { pricingId: z.object({ carId: z.string().uuid(), pricingId: z.string().uuid() }), create: dates(base), update: dates(base.partial()), list: z.object({ page: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().positive().max(100).optional(), status: z.enum(statuses).optional() }), quote };
