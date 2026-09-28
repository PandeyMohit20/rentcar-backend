'use strict';
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const { env } = require('../../config/env');
const AppError = require('../../errors/AppError');
const provider = require('./providers/razorpay');
const { minorUnits, finalizeCapturedPayment } = require('./service');
const failure = (message, code = 'PAYMENT_RECONCILIATION_MISMATCH', status = 409) =>
  new AppError(message, status, code);
const isSettled = (b, p) =>
  ['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(b.status) &&
  b.paymentStatus === 'succeeded' &&
  p.status === 'succeeded' &&
  p.operationalStatus === 'normal';

// Provider reads are bounded and use only server-stored order IDs. A retry can
// create another order, so neither creation order nor local status proves capture.
async function resolveOrders(orders, booking, userId) {
  const snapshots = [];
  const captures = [];
  const seen = new Set();
  let attempts = 0;
  for (const payment of orders) {
    if (
      payment.userId !== userId ||
      payment.bookingId !== booking.id ||
      minorUnits(payment.amount) !== minorUnits(booking.totalAmount) ||
      payment.currencyCode !== booking.currencyCode
    )
      throw failure('Stored payment does not match the booking.');
    const remote = await provider.fetchOrderState(payment.providerOrderId);
    if (
      remote.order?.id !== payment.providerOrderId ||
      !Number.isSafeInteger(remote.order.amount) ||
      remote.order.amount !== minorUnits(payment.amount) ||
      remote.order.currency !== payment.currencyCode ||
      remote.complete !== true ||
      !Array.isArray(remote.payments)
    )
      throw failure('Provider order lookup is incomplete or inconsistent.');
    attempts += remote.payments.length;
    if (attempts > 100) throw failure('Provider attempt limit requires operator review.');
    const verified = [];
    for (const listed of remote.payments) {
      if (!listed.id || seen.has(listed.id) || listed.order_id !== payment.providerOrderId)
        throw failure('Provider payment/order association is inconsistent.');
      seen.add(listed.id);
      const entity = await provider.fetchPaymentState(listed.id);
      if (
        entity?.id !== listed.id ||
        entity.order_id !== payment.providerOrderId ||
        !Number.isSafeInteger(entity.amount) ||
        entity.amount !== minorUnits(payment.amount) ||
        entity.currency !== payment.currencyCode
      )
        throw failure('Provider payment does not match the stored payment.');
      if (!['captured', 'created', 'pending', 'failed', 'authorized'].includes(entity.status))
        throw failure('Provider payment state requires operator review.');
      verified.push(entity);
      if (entity.status === 'captured') captures.push({ payment, entity });
    }
    snapshots.push({ payment, remote: { ...remote, payments: verified } });
  }
  if (captures.length > 1) {
    const err = failure(
      'Multiple captured payments require operator review.',
      'MULTIPLE_CAPTURED_PAYMENTS_REQUIRES_REVIEW',
    );
    err.captureIds = captures.map(({ entity }) => entity.id);
    throw err;
  }
  if (captures.length === 1) {
    if (snapshots.some((s) => s.remote.payments.some((p) => p.status === 'authorized')))
      throw failure('An authorized competing payment requires operator review.');
    const match = captures[0];
    return { ...match, providerStatus: 'captured' };
  }
  // Several failed/abandoned orders do not establish a successful payment.
  return { payment: orders[0], entity: null, providerStatus: 'created' };
}
const auditData = (booking, payment, userId, outcome, extra = {}) => ({
  userId,
  action: 'payment.reconcile',
  module: 'payments',
  entity: 'Booking',
  entityId: booking.id,
  result: outcome,
  metadata: JSON.stringify({
    source: 'provider_reconciliation',
    bookingId: booking.id,
    localPaymentId: payment?.id || null,
    orderId: payment?.providerOrderId || null,
    previousStatus: payment?.status || null,
    ...extra,
  }),
});
async function reconcile({ userId, bookingId }) {
  const candidate = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
  if (!candidate) throw failure('Booking not found.', 'RESOURCE_NOT_FOUND', 404);
  if (
    candidate.financialSnapshot?.taxMode === 'UAT_BYPASS' &&
    (!require('../../config/uatTax').isUatTaxBypass() ||
      !env.RAZORPAY_KEY_ID.startsWith('rzp_test_'))
  )
    throw failure('UAT recovery requires enabled UAT mode and TEST credentials.');
  const locked = (work) =>
    prisma.$transaction(async (tx) => {
      // First DB operation in transaction, shared with webhook/order/cancellation locks.
      if (tx.$queryRaw)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM cars WHERE id = ${candidate.carId} FOR UPDATE`,
        );
      const b = await tx.booking.findFirst({ where: { id: bookingId, userId } });
      if (!b || b.carId !== candidate.carId)
        throw failure('Booking not found.', 'RESOURCE_NOT_FOUND', 404);
      return work(tx, b);
    });
  const claim = await locked(async (tx, b) => {
    const orders = (
      await tx.payment.findMany({ where: { bookingId, provider: 'razorpay' } })
    ).filter((p) => p.providerOrderId);
    if (
      !orders.length ||
      orders.length > 10 ||
      new Set(orders.map((p) => p.providerOrderId)).size !== orders.length
    ) {
      await require('../vendors/settlementFinancialGuard').markFinancialReview(tx, bookingId, 'PAYMENT_RECONCILIATION_CONFLICT');
      await tx.auditLog.create({ data: auditData(b, null, userId, 'ambiguous_order') });
      return {
        error: failure(
          'One to ten uniquely associated stored orders are required for recovery.',
          'PAYMENT_RECONCILIATION_AMBIGUOUS',
        ),
      };
    }
    const payment = orders[0];
    if (orders.length === 1 && isSettled(b, payment))
      return { settled: true, bookingStatus: b.status, paymentStatus: payment.status };
    if (
      orders.some(
        (p) =>
          p.status === 'refunded' ||
          ['review_required', 'late_payment_conflict'].includes(p.operationalStatus),
      )
    )
      throw failure('Payment requires operator review before recovery.');
    const recent = await tx.auditLog.findFirst({
      where: {
        action: 'payment.reconcile',
        entityId: bookingId,
        createdAt: { gte: new Date(Date.now() - 30000) },
      },
    });
    if (recent)
      throw failure(
        'Please wait 30 seconds before checking the provider again.',
        'RATE_LIMITED',
        429,
      );
    await require('../vendors/settlementFinancialGuard').markFinancialReview(tx, bookingId, 'PAYMENT_RECONCILIATION_STARTED');
    const audit = await tx.auditLog.create({
      data: auditData(b, payment, userId, 'fetch_started'),
    });
    return { payment, orders, booking: b, auditId: audit.id };
  });
  if (claim.error) throw claim.error;
  if (claim.settled)
    return {
      outcome: 'already_settled',
      bookingId,
      bookingStatus: claim.bookingStatus,
      paymentStatus: claim.paymentStatus,
    };
  let { payment } = claim;
  const { auditId, orders } = claim;
  let providerStatus = 'unknown',
    providerPaymentId = null;
  try {
    let entity;
    if (orders.length > 1) {
      const resolved = await resolveOrders(orders, claim.booking, userId);
      payment = resolved.payment;
      entity = resolved.entity;
      providerStatus = resolved.providerStatus;
      providerPaymentId = entity?.id || null;
    } else {
      const remote = await provider.fetchOrderState(payment.providerOrderId);
      const { order, payments } = remote;
      if (
        order.id !== payment.providerOrderId ||
        !Number.isSafeInteger(order.amount) ||
        order.amount !== minorUnits(payment.amount) ||
        order.currency !== payment.currencyCode
      )
        throw failure('Provider order does not match the stored payment.');
      if (
        !Array.isArray(payments) ||
        remote.complete !== true ||
        payments.some((p) => p.order_id !== payment.providerOrderId)
      )
        throw failure('Provider payment lookup is incomplete or inconsistent.');
      const captures = payments.filter((p) => p.status === 'captured');
      // Failed/created historical attempts may coexist with exactly one captured payment.
      if (
        captures.length > 1 ||
        (!captures.length && payments.length > 1) ||
        (captures.length === 1 &&
          payments.some(
            (p) => p.id !== captures[0].id && !['created', 'failed'].includes(p.status),
          ))
      )
        throw failure('Provider payment lookup is ambiguous.', 'PAYMENT_RECONCILIATION_AMBIGUOUS');
      entity = captures[0] || payments[0] || null;
      if (entity) {
        const expectedId = entity.id;
        entity = await provider.fetchPaymentState(expectedId);
        if (
          !entity ||
          entity.id !== expectedId ||
          entity.order_id !== payment.providerOrderId ||
          !Number.isSafeInteger(entity.amount) ||
          entity.amount !== minorUnits(payment.amount) ||
          entity.currency !== payment.currencyCode
        )
          throw failure('Provider payment does not match the stored payment.');
        providerPaymentId = entity.id;
        providerStatus = entity.status;
      } else providerStatus = 'created';
      if (!['captured', 'created', 'pending', 'authorized', 'failed'].includes(providerStatus))
        throw failure('Provider payment state requires operator review.');
    }
    return await locked(async (tx, b) => {
      const freshOrders = (
        await tx.payment.findMany({ where: { bookingId, provider: 'razorpay' } })
      ).filter((p) => p.providerOrderId);
      if (
        freshOrders.length !== orders.length ||
        orders.some(
          (previous) =>
            !freshOrders.some(
              (p) =>
                p.id === previous.id &&
                p.providerOrderId === previous.providerOrderId &&
                p.userId === userId &&
                p.currencyCode === previous.currencyCode &&
                minorUnits(p.amount) === minorUnits(previous.amount),
            ),
        )
      )
        throw failure('Stored order set changed during provider verification.');
      if (
        freshOrders.some((p) =>
          ['review_required', 'late_payment_conflict'].includes(p.operationalStatus),
        )
      )
        throw failure('Payment requires operator review before recovery.');
      const current = await tx.payment.findUnique({ where: { id: payment.id } });
      if (
        !current ||
        current.bookingId !== bookingId ||
        current.providerOrderId !== payment.providerOrderId ||
        minorUnits(current.amount) !== minorUnits(payment.amount) ||
        current.currencyCode !== payment.currencyCode ||
        current.userId !== userId ||
        minorUnits(b.totalAmount) !== minorUnits(current.amount) ||
        b.currencyCode !== current.currencyCode
      )
        throw failure('Stored payment changed during provider verification.');
      if (['review_required', 'late_payment_conflict'].includes(current.operationalStatus))
        throw failure('Payment requires operator review before recovery.');
      let result;
      if (isSettled(b, current)) result = { duplicatePayment: true };
      else if (providerStatus === 'captured')
        result = await finalizeCapturedPayment(tx, current, b, entity, { strict: true });
      else {
        // A late provider response must never downgrade money already captured/refunded.
        if (!require('./recovery').hasCapturedMoney(current)) {
          if (providerStatus === 'failed')
            await tx.payment.update({
              where: { id: current.id },
              data: {
                status: 'failed',
                failedAt: new Date(),
                failureReason: 'Payment provider reported failure.',
              },
            });
          else if (providerStatus === 'authorized')
            await tx.payment.update({ where: { id: current.id }, data: { status: 'processing' } });
        }
        result = { pending: providerStatus !== 'failed', failed: providerStatus === 'failed' };
      }
      const finalPayment = await tx.payment.findUnique({ where: { id: current.id } });
      const finalBooking = await tx.booking.findUnique({ where: { id: bookingId } });
      const outcome = result.confirmed
        ? 'reconciled'
        : result.duplicatePayment || result.alreadySettled
          ? 'already_settled'
          : result.latePaymentConflict
            ? 'review_required'
            : result.failed
              ? 'failed'
              : 'pending';
      await tx.auditLog.update({
        where: { id: auditId },
        data: auditData(candidate, payment, userId, outcome, {
          providerPaymentId,
          providerStatus,
          resultingStatus: finalPayment.status,
          bookingStatus: finalBooking.status,
        }),
      });
      return {
        outcome,
        bookingId,
        paymentId: current.id,
        bookingStatus: finalBooking.status,
        paymentStatus: finalPayment.status,
      };
    });
  } catch (err) {
    const known = err instanceof AppError;
    await prisma.auditLog.update({
      where: { id: auditId },
      data: {
        result:
          err.code === 'MULTIPLE_CAPTURED_PAYMENTS_REQUIRES_REVIEW'
            ? 'requires_review'
            : known && err.statusCode === 409
              ? 'rejected'
              : 'error',
        metadata: JSON.stringify({
          source: 'provider_reconciliation',
          bookingId,
          localPaymentId: payment.id,
          orderId: payment.providerOrderId,
          providerPaymentId,
          previousStatus: payment.status,
          providerStatus,
          code: known ? err.code : 'PAYMENT_PROVIDER_UNAVAILABLE',
          ...(err.captureIds ? { capturedPaymentIds: err.captureIds } : {}),
        }),
      },
    });
    if (known) throw err;
    if (err.code === 'P2002')
      throw failure('Provider payment is already associated with another transaction.');
    throw failure(
      'Payment provider verification is temporarily unavailable. Please retry later.',
      'PAYMENT_PROVIDER_UNAVAILABLE',
      503,
    );
  }
}
module.exports = { reconcile };
