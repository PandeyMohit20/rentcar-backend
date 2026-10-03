'use strict';

const { z } = require('zod');

const analyticsQuerySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

    vendorId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    carId: z.string().uuid().optional(),

    city: z.string().trim().min(1).max(100).optional(),

    bookingStatus: z
      .enum([
        'PENDING',
        'CONFIRMED',
        'PAYMENT_PENDING',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
        'REJECTED',
      ])
      .optional(),

    paymentStatus: z
      .enum([
        'pending',
        'processing',
        'succeeded',
        'failed',
        'cancelled',
        'refunded',
      ])
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'endDate must be on or after startDate.',
      });
    }
  });

module.exports = {
  analyticsQuerySchema,
};