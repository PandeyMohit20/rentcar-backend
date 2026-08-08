'use strict';

const { prisma } = require('../config/database');

/**
 * Transaction foundation.
 * Future services must use prisma.$transaction for atomic flows:
 *   - Booking creation/cancellation
 *   - Payment/refund creation
 *   - Wallet debits/credits
 *   - Coupon usage
 *   - Vendor settlement
 *
 * Provides a thin wrapper to keep transaction semantics consistent.
 * Usage:
 *   await withTransaction(async (tx) => { ... });
 * The callback receives a Prisma transaction client (tx).
 */
async function withTransaction(fn) {
  return prisma.$transaction((tx) => fn(tx));
}

/**
 * Run multiple independent queries as an interactive transaction
 * with an explicit isolation level (applicable when the DB supports it).
 * Placeholder for future needs — uses default isolation now.
 */
async function runTransaction(fn, options = { isolationLevel: undefined }) {
  const txOptions = options.isolationLevel ? { isolationLevel: options.isolationLevel } : undefined;
  return prisma.$transaction(fn, txOptions);
}

module.exports = { prisma, withTransaction, runTransaction };
