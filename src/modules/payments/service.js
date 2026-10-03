'use strict';
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const razorpay = require('./providers/razorpay');
const invoices = require('../invoices/service');
const { PaymentsRepository } = require('./repository');
const { hasCapturedMoney } = require('./recovery');

const notFound = () =>
  new AppError(
    'Payment or booking not found.',
    httpStatus.NOT_FOUND,
    errorCodes.RESOURCE_NOT_FOUND,
  );
const conflict = (message, code = errorCodes.CONFLICT) =>
  new AppError(message, httpStatus.CONFLICT, code);
function minorUnits(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match)
    throw new AppError(
      'Payment amount cannot be represented in minor units.',
      httpStatus.UNPROCESSABLE_ENTITY,
      errorCodes.VALIDATION_ERROR,
    );
  const paise = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (paise > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AppError(
      'Payment amount is too large.',
      httpStatus.UNPROCESSABLE_ENTITY,
      errorCodes.VALIDATION_ERROR,
    );
  return Number(paise);
}
function dto(payment) {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    amount: payment.amount,
    currencyCode: payment.currencyCode,
    paymentMethod: payment.paymentMethod,
    provider: payment.provider,
    status: payment.status,
    operationalStatus: payment.operationalStatus,
    providerOrderId: payment.providerOrderId,
    providerPaymentId: payment.providerPaymentId,
    paidAt: payment.paidAt,
    failedAt: payment.failedAt,
    failureReason: payment.failureReason,
  };
}
function payable(booking) {
  if (booking.status !== 'PAYMENT_PENDING' || booking.paymentStatus !== 'pending')
    throw conflict('Booking is not payable.', errorCodes.BOOKING_NOT_PAYABLE);
  if (!booking.holdExpiresAt || new Date(booking.holdExpiresAt) <= new Date())
    throw conflict('Booking hold has expired.', errorCodes.BOOKING_HOLD_EXPIRED);
}
async function activeAttempt(db, bookingId) {
  const payments = await db.payment.findMany({ where: { bookingId } });
  return (
    payments.find(
      (payment) =>
        payment.provider === 'razorpay' && ['pending', 'processing'].includes(payment.status),
    ) || null
  );
}
async function createOrder({ userId, bookingId }) {
  const candidate = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
  if (!candidate) throw notFound();
  if (
    candidate.financialSnapshot?.taxMode === 'UAT_BYPASS' &&
    (!require('../../config/uatTax').isUatTaxBypass() ||
      !require('../../config/env').env.RAZORPAY_KEY_ID.startsWith('rzp_test_'))
  )
    throw conflict('UAT payments require enabled UAT mode and Razorpay TEST credentials.');
  const locked = (work) =>
    prisma.$transaction(
      async (tx) => {
        // Same first-operation car lock as capture reconciliation. No booking lock is
        // acquired before this lock, and no repeatable-read snapshot predates it.
        if (tx.$queryRaw)
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM cars WHERE id = ${candidate.carId} FOR UPDATE`,
          );
        const booking = await tx.booking.findFirst({ where: { id: bookingId, userId } });
        if (!booking || booking.carId !== candidate.carId) throw notFound();
        const payments = await tx.payment.findMany({ where: { bookingId } });
        if (payments.some(hasCapturedMoney))
          throw conflict(
            'Payment has already been captured for this booking.',
            errorCodes.BOOKING_NOT_PAYABLE,
          );
        payable(booking);
        return work(tx, booking);
      },
      { timeout: 20000 },
    );
  const claim = await locked(async (tx, booking) => {
    const existing = await activeAttempt(tx, booking.id);
    if (existing)
      return {
        payment: existing,
        reused: Boolean(existing.providerOrderId),
        inProgress: !existing.providerOrderId,
      };
    const payment = await tx.payment.create({
      data: {
        bookingId,
        userId,
        amount: booking.totalAmount,
        currencyCode: booking.currencyCode,
        paymentMethod: 'card',
        provider: 'razorpay',
        status: 'pending',
        operationalStatus: 'normal',
        transactionReference: `PAY-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
      },
    });
    return { payment, reused: false };
  });
  if (claim.inProgress)
    throw conflict(
      'A payment order is already being created for this booking.',
      errorCodes.BOOKING_NOT_PAYABLE,
    );
  const response = (payment, reused) => ({
    payment: dto(payment),
    keyId: require('../../config/env').env.RAZORPAY_KEY_ID,
    reused,
  });
  if (claim.reused) return response(claim.payment, true);
  // Capture of an older attempt may win after the claim commits. Recheck under
  // the car lock and retain it through provider creation to close that gap.
  const result = await locked(async (tx, booking) => {
    const payment = await tx.payment.findUnique({ where: { id: claim.payment.id } });
    if (!payment || payment.status !== 'pending')
      throw conflict('Payment attempt is no longer pending.', errorCodes.BOOKING_NOT_PAYABLE);
    if (payment.providerOrderId) return response(payment, true);
    let order;
    try {
      order = await razorpay.createOrder({
        amount: minorUnits(booking.totalAmount),
        currency: booking.currencyCode,
        receipt: payment.transactionReference,
      });
      if (!order?.id) throw new Error('Razorpay did not return an order ID');
    } catch (err) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'Payment provider order creation failed.',
        },
      });
      return {
        error:
          err instanceof AppError
            ? err
            : new AppError(
                'Payment provider order creation failed.',
                httpStatus.SERVICE_UNAVAILABLE,
                errorCodes.PAYMENT_PROVIDER_UNAVAILABLE,
              ),
      };
    }
    return response(
      await tx.payment.update({ where: { id: payment.id }, data: { providerOrderId: order.id } }),
      false,
    );
  });
  if (result.error) throw result.error;
  return result;
}
async function verifyCheckout({ userId, bookingId, orderId, paymentId, signature }) {
  const payment = await prisma.payment.findFirst({
    where: { bookingId, userId, provider: 'razorpay', providerOrderId: orderId },
  });
  if (!payment) throw notFound();
  if (payment.providerOrderId !== orderId)
    throw conflict('Payment order does not match.', errorCodes.PAYMENT_ORDER_MISMATCH);
  if (!razorpay.verifyCheckoutSignature({ orderId: payment.providerOrderId, paymentId, signature }))
    throw new AppError(
      'Payment signature is invalid.',
      httpStatus.BAD_REQUEST,
      errorCodes.PAYMENT_SIGNATURE_INVALID,
    );
  return { verified: true, payment: dto(payment) };
}
function blockingOther(bookings, current, now) {
  return bookings.some(
    (booking) =>
      booking.id !== current.id &&
      new Date(booking.startAt) < new Date(current.endAt) &&
      new Date(booking.endAt) > new Date(current.startAt) &&
      ((['PENDING', 'PAYMENT_PENDING'].includes(booking.status) &&
        booking.holdExpiresAt &&
        new Date(booking.holdExpiresAt) > now) ||
        ['CONFIRMED', 'ACTIVE'].includes(booking.status)),
  );
}
// Caller must hold the car row lock as the transaction's first operation.
// Both verified webhooks and server-fetched captures converge here.
async function finalizeCapturedPayment(
  tx,
  payment,
  booking,
  entity,
  { strict = false, afterPaymentUpdate } = {},
) {
  const linked = entity?.id
    ? await tx.payment.findFirst({ where: { providerPaymentId: entity.id } })
    : null;
  const samePayment =
    entity?.id &&
    (!payment.providerPaymentId || payment.providerPaymentId === entity.id) &&
    (!linked || linked.id === payment.id);
  const valid =
    entity.order_id === payment.providerOrderId &&
    (!entity.status || entity.status === 'captured') &&
    Number.isSafeInteger(entity.amount) &&
    entity.amount === minorUnits(payment.amount) &&
    minorUnits(payment.amount) === minorUnits(booking.totalAmount) &&
    entity.currency === payment.currencyCode &&
    payment.currencyCode === booking.currencyCode &&
    payment.userId === booking.userId &&
    samePayment;
  if (!valid) {
    if (strict)
      throw conflict(
        'Provider payment does not match the stored booking.',
        'PAYMENT_RECONCILIATION_MISMATCH',
      );
    await require('../vendors/settlementFinancialGuard').markFinancialReview(tx, booking.id, 'PAYMENT_CAPTURE_CHANGED');
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded', operationalStatus: 'review_required', paidAt: new Date() },
    });
    return { reviewRequired: true };
  }
  if (payment.status === 'refunded') return { alreadySettled: true };
  if (
    payment.status === 'succeeded' &&
    ['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(booking.status)
  )
    return { duplicatePayment: true };
  const otherCaptured = (await tx.payment.findMany({ where: { bookingId: booking.id } })).some(
    (p) => p.id !== payment.id && hasCapturedMoney(p),
  );
  const all = await tx.booking.findMany({ where: { carId: booking.carId } });
  if (
    otherCaptured ||
    !['PENDING', 'PAYMENT_PENDING', 'EXPIRED'].includes(booking.status) ||
    blockingOther(all, booking, new Date())
  ) {
    await require('../vendors/settlementFinancialGuard').markFinancialReview(tx, booking.id, 'PAYMENT_CAPTURE_CHANGED');
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        providerPaymentId: entity.id,
        paidAt: new Date(),
        operationalStatus: 'late_payment_conflict',
      },
    });
    return { latePaymentConflict: true };
  }
  await require('../vendors/settlementFinancialGuard').markFinancialReview(tx, booking.id, 'PAYMENT_CAPTURE_CHANGED');
  const settledPayment = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'succeeded',
      providerPaymentId: entity.id,
      paidAt: new Date(),
      operationalStatus: 'normal',
    },
  });
  if (afterPaymentUpdate) await afterPaymentUpdate();
  const confirmedBooking = await tx.booking.update({
    where: { id: booking.id },
    data: { status: 'CONFIRMED', paymentStatus: 'succeeded' },
  });
  await tx.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'CONFIRMED',
      changedBy: null,
      reason: 'Razorpay payment captured.',
    },
  });
  await invoices.ensureForPaidBooking(tx, confirmedBooking, settledPayment);
  return { confirmed: true };
}

async function processWebhookLocked({ eventId, rawBody, afterPaymentUpdate }) {
  const event = razorpay.parseWebhookEvent(rawBody);
  const type = event.event;
  const entity = event.payload?.payment?.entity;
  const hash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const candidate = entity?.order_id
    ? await prisma.payment.findFirst({ where: { providerOrderId: entity.order_id } })
    : null;
  const candidateBooking = candidate
    ? await prisma.booking.findUnique({ where: { id: candidate.bookingId } })
    : null;
  try {
    return await prisma.$transaction(async (tx) => {
      // IMPORTANT: this must remain the first transaction DB operation; MySQL read views must not predate the car lock.
      if (candidateBooking && tx.$queryRaw)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM cars WHERE id = ${candidateBooking.carId} FOR UPDATE`,
        );
      const webhook = await tx.paymentWebhookEvent.create({
        data: {
          provider: 'razorpay',
          providerEventId: eventId,
          eventType: String(type || 'unknown'),
          payloadHash: hash,
        },
      });
      const done = async (paymentId, result) => {
        if (paymentId && candidateBooking) await require('../vendors/settlementFinancialGuard').markFinancialReview(tx, candidateBooking.id, 'PAYMENT_EVENT_RECORDED');
        await tx.paymentWebhookEvent.update({
          where: { id: webhook.id },
          data: { paymentId, processedAt: new Date() },
        });
        return result;
      };
      if (!entity?.order_id) return done(null, { ignored: true });
      const payment = await tx.payment.findFirst({ where: { providerOrderId: entity.order_id } });
      if (!payment) return done(null, { ignored: true });
      if (type === 'payment.authorized') {
        if (!hasCapturedMoney(payment))
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'processing' } });
        return done(payment.id, { processed: true });
      }
      if (type === 'payment.failed') {
        if (!hasCapturedMoney(payment))
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
              failureReason: String(entity.error_description || 'Razorpay payment failed.').slice(
                0,
                500,
              ),
            },
          });
        return done(payment.id, { processed: true });
      }
      if (type !== 'payment.captured') return done(payment.id, { ignored: true });
      const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } });
      if (!booking || booking.carId !== candidateBooking?.carId)
        return done(payment.id, { ignored: true });
      return done(
        payment.id,
        await finalizeCapturedPayment(tx, payment, booking, entity, { afterPaymentUpdate }),
      );
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await prisma.paymentWebhookEvent.findFirst({
        where: { provider: 'razorpay', providerEventId: eventId },
      });
      if (existing) return { duplicate: true };
      throw conflict(
        'Provider payment is already associated with another transaction.',
        'PAYMENT_RECONCILIATION_MISMATCH',
      );
    }
    throw err;
  }
}
async function getPayment(userId, paymentId) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, userId } });
  if (!payment) throw notFound();
  return dto(payment);
}

/**
 * Admin: list payments.
 *
 * Read-only endpoint used by the admin payment management screen.
 */
async function listAdminPayments(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const result = await PaymentsRepository.listAdminPayments({
    skip,
    take: limit,
    search: query.search,
    status: query.status,
    operationalStatus: query.operationalStatus,
    provider: query.provider,
    paymentMethod: query.paymentMethod,
  });

  return {
    data: result.items.map(dto),
    meta: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  };
}

/**
 * Admin: get payment by ID.
 *
 * Read-only endpoint used by the admin payment detail screen.
 */
async function getAdminPayment(paymentId) {
  const payment = await PaymentsRepository.findAdminPaymentById(paymentId);

  if (!payment) {
    throw notFound();
  }

  return dto(payment);
}
module.exports = {
  minorUnits,
  createOrder,
  verifyCheckout,
  processWebhook: processWebhookLocked,
  getPayment,
  listAdminPayments,
  getAdminPayment,
  dto,
  finalizeCapturedPayment,
};
