'use strict';

const { z } = require('zod');

const transactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

const createTopupSchema = z
  .object({
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim())
      .refine(
        (value) => /^\d+(?:\.\d{1,2})?$/.test(value),
        'Amount must have at most 2 decimal places.',
      )
      .refine((value) => Number(value) >= 1, 'Minimum wallet top-up amount is INR 1.')
      .refine((value) => Number(value) <= 100000, 'Maximum wallet top-up amount is INR 100000.'),
  })
  .strict();

const verifyTopupSchema = z
  .object({
    topupId: z.string().uuid(),
    razorpayOrderId: z.string().trim().min(1).max(100),
    razorpayPaymentId: z.string().trim().min(1).max(100),
    razorpaySignature: z.string().trim().min(1).max(255),
  })
  .strict();

module.exports = {
  transactionsQuerySchema,
  createTopupSchema,
  verifyTopupSchema,
};
