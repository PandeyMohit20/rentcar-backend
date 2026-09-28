'use strict';

const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const { assertSettlementReadAccess } = require('./settlementAccess');

// Only the bounded candidate page is expanded. Never filter payment attempts by status.
async function readPreviewCandidates(user, vendorId, { page, pageSize, currency }) {
  return prisma.$transaction(async (db) => {
    await assertSettlementReadAccess(user, vendorId, db);
    const vendor = await db.vendor.findUnique({ where: { id: vendorId }, select: { id: true, isDeleted: true } });
    if (!vendor || vendor.isDeleted) throw new AppError('Vendor not found.', 404, 'RESOURCE_NOT_FOUND');
    const where = { vendorId, status: 'COMPLETED', ...(currency ? { currencyCode: currency } : {}) };
    const total = await db.booking.count({ where });
    const bookings = await db.booking.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, bookingNumber: true, vendorId: true, userId: true, status: true,
        currencyCode: true, subtotal: true, tax: true, discount: true, securityDeposit: true,
        totalAmount: true, vendorCommissionRate: true, vendorCommision: true,
        financialSnapshot: true, billingSnapshot: true, paymentStatus: true, carId: true,
      },
    });
    const candidates = [];
    for (const booking of bookings) {
      const payments = await db.payment.findMany({ where: { bookingId: booking.id }, select: {
        id: true, bookingId: true, userId: true, amount: true, currencyCode: true,
        status: true, operationalStatus: true, paidAt: true, providerPaymentId: true, createdAt: true,
      } });
      const paymentRefunds = payments.length ? await db.refund.findMany({
        where: { paymentId: { in: payments.map((p) => p.id) } },
        select: { id: true, paymentId: true, bookingId: true, amount: true, currencyCode: true, status: true },
      }) : [];
      const bookingRefunds = await db.refund.findMany({ where: { bookingId: booking.id } });
      const refunds = [...new Map([...paymentRefunds, ...bookingRefunds].map((r) => [r.id, r])).values()];
      const trips = await db.tripHistory.findMany({ where: { bookingId: booking.id } });
      const items = await db.vendorSettlementItem.findMany({
        where: { bookingId: booking.id }, select: { bookingId: true, paymentId: true, settlementId: true },
      });
      // A cap is safe only when incomplete evidence explicitly blocks eligibility.
      const audits = await db.auditLog.findMany({
        where: { entityId: booking.id, action: 'payment.reconcile' },
        select: { result: true, metadata: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 201,
      });
      candidates.push({ booking, payments, refunds, trips, items, audits, evidenceTruncated: audits.length > 200 });
    }
    return { candidates, total, observedAt: new Date().toISOString() };
  }, { isolationLevel: 'RepeatableRead' });
}

module.exports = { readPreviewCandidates };
