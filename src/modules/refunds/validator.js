'use strict';

const { z } = require('zod');

module.exports = {
  refundId: z.object({ refundId: z.string().uuid() }).strict(),
  bookingId: z.object({ bookingId: z.string().uuid() }).strict(),
};
