'use strict';

const { z } = require('zod');

const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PAYMENT_PENDING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
];

const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
];

const SORT_FIELDS = ['createdAt', 'startAt', 'endAt', 'bookingNumber', 'totalAmount', 'status'];

const optionalTrimmed = (max) => z.string().trim().min(1).max(max).optional();
const optionalUuid = z.string().uuid().optional();
const optionalTimestamp = z.string().datetime({ offset: true }).optional();

const sharedListShape = {
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  bookingNumber: optionalTrimmed(50),
  search: optionalTrimmed(50),
  status: z.enum(BOOKING_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  vendorId: optionalUuid,
  carId: optionalUuid,
  startFrom: optionalTimestamp,
  startTo: optionalTimestamp,
  sortBy: z.enum(SORT_FIELDS).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
};

function validDateRange(value) {
  return !value.startFrom || !value.startTo || new Date(value.startFrom) <= new Date(value.startTo);
}

const rangeMessage = {
  message: 'startTo must be greater than or equal to startFrom.',
  path: ['startTo'],
};

const adminList = z
  .object({ ...sharedListShape, userId: optionalUuid })
  .strict()
  .refine(validDateRange, rangeMessage);

const vendorList = z.object(sharedListShape).strict().refine(validDateRange, rangeMessage);

const bookingId = z.object({ bookingId: z.string().uuid() }).strict();

module.exports = {
  adminList,
  vendorList,
  bookingId,
  SORT_FIELDS,
};
