'use strict';
const { z } = require('zod');
module.exports = { invoiceId: z.object({ invoiceId: z.string().uuid() }).strict(), bookingId: z.object({ bookingId: z.string().uuid() }).strict() };
