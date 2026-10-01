'use strict';

const { z } = require('zod');
const { BOOKING_STATUSES, PAYMENT_STATUSES } = require('./constants');

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const reportsQuerySchema = z
  .object({
    startDate: dateField.optional(),
    endDate: dateField.optional(),

    vendorId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    carId: z.string().uuid().optional(),

    status: z.enum(BOOKING_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
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
  reportsQuerySchema,
};
