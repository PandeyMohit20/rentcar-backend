'use strict';

/**
 * Payment lifecycle statuses.
 * Mirrors PaymentStatusEnum in rentcar-database.
 */
module.exports = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};
