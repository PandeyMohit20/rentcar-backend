'use strict';
const { z } = require('zod');
const id = z.string().uuid();
const order = z.object({ bookingId: id }).strict();
const verify = z.object({ bookingId: id, razorpay_order_id: z.string().trim().min(1).max(100), razorpay_payment_id: z.string().trim().min(1).max(100), razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i) }).strict();
module.exports = { order, verify, paymentId: z.object({ paymentId: id }) };
