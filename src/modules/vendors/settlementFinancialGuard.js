'use strict';

const { Prisma } = require('@prisma/client');
const AppError = require('../../errors/AppError');

// Car locks precede every snapshot read, matching capture/reconciliation.
async function lockCars(tx, carIds) {
  for (const id of [...new Set(carIds)].sort()) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM cars WHERE id = ${id} FOR UPDATE`);
  }
}

async function markFinancialReview(tx, bookingId, reason) {
  const items = await tx.vendorSettlementItem.findMany({ where: { bookingId } });
  for (const id of [...new Set(items.map((item) => item.settlementId))].sort()) {
    await tx.vendorSettlement.updateMany({
      where: { id, status: 'pending', requiresFinancialReview: false },
      data: { requiresFinancialReview: true, financialReviewReason: reason },
    });
  }
}

async function retryTransaction(work) {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); } catch (err) {
      const retryable = err.code === 'P2034' ||
        (err.code === 'P2010' && ['1213', '40001'].includes(String(err.meta?.code)));
      if (!retryable || attempt === 2) throw err;
    }
  }
}

async function financialTransaction(db, bookingId, reason, work) {
  const candidate = await db.booking.findUnique({ where: { id: bookingId } });
  if (!candidate) throw new AppError('Booking not found.', 404, 'RESOURCE_NOT_FOUND');
  return retryTransaction(() => db.$transaction(async (tx) => {
    await lockCars(tx, [candidate.carId]);
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.carId !== candidate.carId) {
      throw new AppError('Booking changed.', 409, 'SETTLEMENT_FINANCIAL_CONFLICT');
    }
    const result = await work(tx);
    await markFinancialReview(tx, bookingId, reason);
    return result;
  }));
}

module.exports = { lockCars, markFinancialReview, retryTransaction, financialTransaction };
