'use strict';

/**
 * Booking lifecycle statuses.
 * Mirrors BookingStatusEnum in rentcar-database.
 */
module.exports = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
};
