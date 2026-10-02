'use strict';

const { z } = require('zod');

const id = z.string().uuid();

const order = z.object({
  bookingId: id,
}).strict();

const verify = z.object({
  bookingId: id,
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i),
}).strict();

const paymentId = z.object({
  paymentId: id,
}).strict();

const adminList = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().max(150).optional(),

  status: z.string().trim().min(1).max(50).optional(),

  operationalStatus: z.string().trim().min(1).max(50).optional(),

  provider: z.string().trim().min(1).max(100).optional(),

  paymentMethod: z.string().trim().min(1).max(50).optional(),
}).strict();

const adminPaymentId = z.object({
  paymentId: id,
}).strict();

module.exports = {
  order,
  verify,
  paymentId,
  adminList,
  adminPaymentId,
};
