'use strict';

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { z } = require('zod');
const { prisma } = require('../../config/database');
const { hasPermission } = require('../../services/authorization.service');
const AppError = require('../../errors/AppError');
const { evaluateSettlementEligibility } = require('./settlementEligibility');
const { minor, money } = require('./settlementPolicy');
const { lockCars, retryTransaction } = require('./settlementFinancialGuard');

const bodySchema = z.object({
  bookingIds: z.array(z.string().uuid().transform((s) => s.toLowerCase())).min(1).max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate booking IDs are not allowed.'),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
}).strict();
const keySchema = z.string().trim().min(1).max(200).regex(/^[\x21-\x7e]+$/);
const conflict = (code) => new AppError('Settlement request conflicts with current financial state.', 409, code);
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function dto(db, header) {
  const items = await db.vendorSettlementItem.findMany({ where: { settlementId: header.id }, orderBy: { bookingId: 'asc' } });
  const result = {};
  for (const field of ['id', 'settlementNumber', 'vendorId', 'periodStart', 'periodEnd', 'currencyCode', 'status',
    'requiresFinancialReview', 'financialReviewReason', 'processedAt', 'failedAt', 'failureReason']) result[field] = header[field] ?? null;
  for (const field of ['grossCollected', 'refundAmount', 'commissionAmount', 'securityDeposit', 'adjustmentAmount', 'netPayable']) result[field] = money(minor(header[field]));
  result.bankAccount = null;
  result.itemCount = items.length;
  result.items = items.map((item) => ({ id: item.id, bookingId: item.bookingId, paymentId: item.paymentId,
    currencyCode: item.currencyCode, ...Object.fromEntries(['grossAmount', 'refundAmount', 'commissionAmount', 'securityDeposit', 'netAmount'].map((key) => [key, money(minor(item[key]))])) }));
  return result;
}

async function generateSettlement(user, vendorId, body, rawKey) {
  if (!hasPermission(user, 'admin.all')) throw new AppError('Generation requires admin authority.', 403, 'AUTH_FORBIDDEN');
  vendorId = z.string().uuid().parse(vendorId).toLowerCase();
  const request = bodySchema.parse(body);
  const key = keySchema.parse(rawKey);
  const bookingIds = [...request.bookingIds].sort();
  const idempotencyKeyHash = digest(key);
  // Explicit tuple order is the versioned canonical serialization contract.
  const requestHash = digest(JSON.stringify(['vendor-settlement-v1', vendorId, request.currencyCode, bookingIds]));
  const findReplay = (db) => db.vendorSettlement.findFirst({ where: { vendorId, idempotencyKeyHash } });
  const replay = async (db, existing) => {
    if (existing.requestHash !== requestHash) throw conflict('SETTLEMENT_IDEMPOTENCY_CONFLICT');
    return { settlement: await dto(db, existing), replayed: true };
  };
  const existing = await findReplay(prisma);
  if (existing) return replay(prisma, existing);
  const candidates = await prisma.booking.findMany({ where: { id: { in: bookingIds } } });
  if (candidates.length !== bookingIds.length) throw conflict('SETTLEMENT_BOOKING_MISSING');
  try {
    return await retryTransaction(() => prisma.$transaction(async (tx) => {
      await lockCars(tx, candidates.map((b) => b.carId));
      for (const id of bookingIds) await tx.$queryRaw(Prisma.sql`SELECT id FROM bookings WHERE id = ${id} FOR UPDATE`);
      for (const id of bookingIds) await tx.$queryRaw(Prisma.sql`SELECT id FROM payments WHERE booking_id = ${id} ORDER BY id FOR UPDATE`);
      const raced = await findReplay(tx);
      if (raced) return replay(tx, raced);
      const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor || vendor.isDeleted) throw conflict('SETTLEMENT_VENDOR_INVALID');
      const rows = [];
      for (const id of bookingIds) {
        const booking = await tx.booking.findUnique({ where: { id } });
        if (!booking || booking.carId !== candidates.find((b) => b.id === id).carId) throw conflict('SETTLEMENT_BOOKING_CHANGED');
        const payments = await tx.payment.findMany({ where: { bookingId: id } });
        const refundRows = await tx.refund.findMany({ where: { bookingId: id } });
        const paymentRefunds = await tx.refund.findMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
        const refunds = [...new Map([...refundRows, ...paymentRefunds].map((r) => [r.id, r])).values()];
        const trips = await tx.tripHistory.findMany({ where: { bookingId: id } });
        const items = await tx.vendorSettlementItem.findMany({ where: { bookingId: id } });
        const audits = await tx.auditLog.findMany({ where: { entityId: id, action: 'payment.reconcile' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 201 });
        const evaluated = evaluateSettlementEligibility({ booking, payments, refunds, trips, items, audits, evidenceTruncated: audits.length > 200 }, vendorId);
        if (!evaluated.generationReady || booking.currencyCode !== request.currencyCode) throw conflict('SETTLEMENT_BOOKING_INELIGIBLE');
        rows.push({ booking, evaluated, endTime: new Date(trips[0].endTime) });
      }
      const total = (field) => money(rows.reduce((sum, r) => sum + minor(r.evaluated.financialFacts[field]), 0n));
      const ends = rows.map((r) => r.endTime).sort((a, b) => a - b);
      const header = await tx.vendorSettlement.create({ data: {
        settlementNumber: `VS-${crypto.randomUUID()}`, vendorId, bankAccountId: null,
        periodStart: ends[0], periodEnd: ends[ends.length - 1], grossCollected: total('grossCaptured'),
        refundAmount: '0.00', commissionAmount: total('commissionAmountSnapshot'), securityDeposit: total('securityDeposit'),
        adjustmentAmount: '0.00', netPayable: money(rows.reduce((sum, r) => sum + minor(r.evaluated.netPayable), 0n)),
        currencyCode: request.currencyCode, status: 'pending', processedAt: null, failedAt: null, failureReason: null,
        requiresFinancialReview: false, financialReviewReason: null, idempotencyKeyHash, requestHash,
      } });
      for (const r of rows) await tx.vendorSettlementItem.create({ data: {
        settlementId: header.id, bookingId: r.booking.id, paymentId: r.evaluated.payment.paymentId,
        grossAmount: r.evaluated.financialFacts.grossCaptured, refundAmount: '0.00',
        commissionAmount: r.evaluated.financialFacts.commissionAmountSnapshot,
        securityDeposit: r.evaluated.financialFacts.securityDeposit, netAmount: r.evaluated.netPayable,
        currencyCode: request.currencyCode,
      } });
      await tx.auditLog.create({ data: { userId: user.sub, action: 'vendor.settlement.generate', module: 'vendors',
        entity: 'VendorSettlement', entityId: header.id, result: 'created', metadata: JSON.stringify({
          settlementId: header.id, settlementNumber: header.settlementNumber, vendorId, itemCount: rows.length,
          currencyCode: request.currencyCode, netPayable: String(header.netPayable),
        }) } });
      return { settlement: await dto(tx, header), replayed: false };
    }, { maxWait: 10000, timeout: 20000 }));
  } catch (err) {
    const target = String(err.meta?.target || '');
    if (err.code === 'P2002' && /idempotency_key_hash|idempotencyKeyHash/.test(target)) {
      const raced = await findReplay(prisma);
      if (raced) return replay(prisma, raced);
    }
    if (err.code === 'P2002') throw conflict('SETTLEMENT_UNIQUE_CONFLICT');
    throw err;
  }
}

module.exports = { generateSettlement, bodySchema, keySchema };
