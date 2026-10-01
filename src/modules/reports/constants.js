'use strict';

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

const PAYMENT_STATUSES = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'];

const SUCCESSFUL_PAYMENT_STATUSES = ['succeeded', 'refunded'];

const SUCCESSFUL_REFUND_STATUSES = ['succeeded'];

module.exports = {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SUCCESSFUL_PAYMENT_STATUSES,
  SUCCESSFUL_REFUND_STATUSES,
};
