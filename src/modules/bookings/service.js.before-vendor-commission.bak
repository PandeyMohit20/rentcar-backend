'use strict';

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const { env } = require('../../config/env');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { verifyQuote } = require('../pricing/service');
const { checkCarAvailability } = require('../availability/service');
const { selectAuthoritativePayment, customerPaymentSummary } = require('../payments/recovery');

const conflict = (message) => new AppError(message, httpStatus.CONFLICT, errorCodes.CONFLICT);
const notFound = () => new AppError('Booking not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
function fingerprint(userId, quote) { return crypto.createHash('sha256').update(JSON.stringify({ userId, carId: quote.carId, startAt: quote.pickupDateTime, endAt: quote.returnDateTime, pricingId: quote.pricingId, rentalSubtotal: quote.rentalSubtotal, securityDeposit: quote.securityDeposit, payableAmount: quote.payableAmount, currencyCode: quote.currencyCode, financialSnapshot: quote.financialSnapshot })).digest('hex'); }
function safeCar(car, primaryImage) {
  if (!car) return null;
  return {
    id: car.id,
    brand: car.brand,
    model: car.model,
    registrationNumber: car.registrationNumber,
    primaryImage: primaryImage
      ? {
          id: primaryImage.id,
          imageUrl: primaryImage.imageUrl,
          altText: primaryImage.altText,
        }
      : null,
  };
}
function dto(booking, car) { return { id: booking.id, bookingNumber: booking.bookingNumber, status: booking.status, paymentStatus: booking.paymentStatus, carId: booking.carId, startAt: booking.startAt, endAt: booking.endAt, subtotal: booking.subtotal, tax: booking.tax, financialSnapshot: booking.financialSnapshot || null, securityDeposit: booking.securityDeposit, totalAmount: booking.totalAmount, currencyCode: booking.currencyCode, holdExpiresAt: booking.holdExpiresAt, createdAt: booking.createdAt, ...(car ? { car } : {}) }; }
async function customerCars(carIds) {
  const ids = [...new Set(carIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const [cars, primaryImages] = await Promise.all([
    prisma.car.findMany({
      where: { id: { in: ids } },
      select: { id: true, brand: true, model: true, registrationNumber: true },
    }),
    prisma.carImage.findMany({
      where: { carId: { in: ids }, isPrimary: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, carId: true, imageUrl: true, altText: true },
    }),
  ]);
  const imageByCarId = new Map();
  primaryImages.forEach((image) => {
    if (!imageByCarId.has(image.carId)) imageByCarId.set(image.carId, image);
  });
  return new Map(cars.map((car) => [car.id, safeCar(car, imageByCarId.get(car.id))]));
}
async function existing(userId, key) { return prisma.booking.findFirst({ where: { userId, idempotencyKey: key } }); }
function decode(token) { try { return verifyQuote(token); } catch (_) { throw new AppError('Invalid or expired quote token.', httpStatus.UNPROCESSABLE_ENTITY, errorCodes.VALIDATION_ERROR); } }
async function createBooking({ userId, quoteToken, idempotencyKey }) { const quote = decode(quoteToken); const uatBypass = quote.financialSnapshot?.taxMode === 'UAT_BYPASS'; if (uatBypass && !require('../../config/uatTax').isUatTaxBypass()) throw conflict('UAT quote is disabled. Request a fresh quote.'); if (quote.userId && quote.userId !== userId) throw conflict('Quote belongs to another customer.'); if (quote.financialSnapshot?.policyStatus !== 'confirmed' && env.NODE_ENV === 'production') throw conflict('A fresh tax quote is required.'); const hash = fingerprint(userId, quote); const replay = await existing(userId, idempotencyKey); if (replay) { if (replay.idempotencyHash === hash) return { booking: dto(replay), replayed: true }; throw conflict('Idempotency key was already used for a different request.'); } try { const booking = await prisma.$transaction(async (tx) => { if (tx.$queryRaw) await tx.$queryRaw(Prisma.sql`SELECT id FROM cars WHERE id = ${quote.carId} FOR UPDATE`); const availability = await checkCarAvailability(quote.carId, quote.pickupDateTime, quote.returnDateTime, tx); if (!availability.available) throw conflict('Car is no longer available for the requested interval.'); const currentVendor = await tx.vendor.findUnique({ where: { id: availability.car.vendorId }, select: { taxProfile: true } }); if ((quote.financialSnapshot?.policyStatus === 'confirmed' && !quote.financialSnapshot.gstRegistrationStatus) || (quote.financialSnapshot?.gstRegistrationStatus && currentVendor?.taxProfile?.gstRegistrationStatus !== quote.financialSnapshot.gstRegistrationStatus)) throw conflict('Seller tax status changed. Request a fresh quote.'); const billingGate = await tx.setting.findUnique({ where: { key: 'billing.issuer.phase7b.pending' } }); if (!uatBypass && billingGate && JSON.parse(billingGate.value).status === 'PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION') throw conflict('Pricing approval changed. Request a fresh quote after approval.'); const billingSnapshot = quote.billingSnapshot || await require('../invoices/snapshot').billingSnapshot(tx, userId, availability.car.vendorId, availability.car, uatBypass); const holdExpiresAt = new Date(Date.now() + env.BOOKING_HOLD_TTL_MINUTES * 60000); const created = await tx.booking.create({ data: { bookingNumber: `BK-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`, userId, vendorId: availability.car.vendorId, carId: quote.carId, startAt: new Date(quote.pickupDateTime), endAt: new Date(quote.returnDateTime), subtotal: quote.rentalSubtotal, tax: quote.financialSnapshot?.tax.totalTax || 0, financialSnapshot: quote.financialSnapshot || undefined, billingSnapshot, discount: 0, securityDeposit: quote.securityDeposit, totalAmount: quote.payableAmount, currencyCode: quote.currencyCode, status: 'PAYMENT_PENDING', paymentStatus: 'pending', holdExpiresAt, idempotencyKey, idempotencyHash: hash } }); await tx.bookingItem.create({ data: { bookingId: created.id, carId: created.carId, itemType: 'car', quantity: 1, unitPrice: created.subtotal, currencyCode: created.currencyCode, subtotal: created.subtotal } }); await tx.bookingStatusHistory.create({ data: { bookingId: created.id, fromStatus: null, toStatus: 'PAYMENT_PENDING', changedBy: userId, reason: 'Temporary payment hold created.' } }); return created; }); return { booking: dto(booking), replayed: false }; } catch (err) { if (err.code === 'P2002') { const raced = await existing(userId, idempotencyKey); if (raced && raced.idempotencyHash === hash) return { booking: dto(raced), replayed: true }; throw conflict('Idempotency key was already used for a different request.'); } throw err; } }
async function listMine(userId, query) {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const where = { userId, ...(query.status ? { status: query.status } : {}) };
  const [data, total] = await Promise.all([
    prisma.booking.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.booking.count({ where }),
  ]);
  const cars = await customerCars(data.map((booking) => booking.carId));
  return {
    data: data.map((booking) => dto(booking, cars.get(booking.carId))),
    meta: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 },
  };
}
async function getMine(userId, id) {
  const booking = await prisma.booking.findFirst({ where: { id, userId } });
  if (!booking) throw notFound();
  const [payments, cars] = await Promise.all([
    prisma.payment.findMany({ where: { bookingId: booking.id, userId } }),
    customerCars([booking.carId]),
  ]);
  return { ...dto(booking, cars.get(booking.carId)), payment: customerPaymentSummary(selectAuthoritativePayment(payments)) };
}

/** Internal service seam for rollback verification; never routed through HTTP. */
async function cancelBooking({ userId, bookingId, reason, idempotencyKey, testHooks }) {
  const candidate = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
  if (!candidate) throw notFound();

  return prisma.$transaction(async (tx) => {
    // Capture and order creation serialize on Car first. Taking Booking first
    // deadlocks with capture's later Booking update. Keep all snapshot reads
    // after this lock so a capture winner is visible under MySQL repeatable read.
    if (tx.$queryRaw) await tx.$queryRaw(Prisma.sql`SELECT id FROM cars WHERE id = ${candidate.carId} FOR UPDATE`);
    if (tx.$queryRaw) await tx.$queryRaw(Prisma.sql`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`);
    const booking = await tx.booking.findFirst({ where: { id: bookingId, userId } });
    if (!booking || booking.carId !== candidate.carId) throw notFound();
    if (booking.status === 'CANCELLED') return { booking: dto(booking), replayed: true };

    const unpaid = ['PENDING', 'PAYMENT_PENDING'].includes(booking.status) && booking.paymentStatus !== 'succeeded';
    const paid = booking.status === 'CONFIRMED' && booking.paymentStatus === 'succeeded' && new Date() < new Date(booking.startAt);
    if (!unpaid && !paid) throw conflict('Booking cannot be cancelled in its current state.');

    let payment; let refund;
    if (paid) {
      payment = await tx.payment.findFirst({ where: { bookingId: booking.id, status: 'succeeded', provider: 'razorpay' } });
      if (!payment || !payment.providerPaymentId) throw conflict('Booking has no refundable captured payment.');
      refund = await tx.refund.findFirst({ where: { bookingId: booking.id } });
      if (refund) return { booking: dto(booking), refund, replayed: true };
    }

    const now = new Date();
    const updated = await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: reason || null } });
    if (testHooks?.afterBookingMutation) await testHooks.afterBookingMutation({ tx, bookingId: booking.id, booking: updated });

    if (paid) refund = await tx.refund.create({ data: { bookingId: booking.id, paymentId: payment.id, amount: payment.amount, currencyCode: payment.currencyCode, provider: 'razorpay', idempotencyKey, reason: reason || null, status: 'pending' } });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, fromStatus: booking.status, toStatus: 'CANCELLED', changedBy: userId, reason: reason || (paid ? 'Cancelled by customer; refund requested.' : 'Cancelled by customer.') } });
    return paid ? { booking: dto(updated), refund, replayed: false } : { booking: dto(updated), replayed: false };
  });
}

async function reconcileRefund(refund, payment, result) { return require('../refunds/service').reconcileProviderResult(refund, result); }
async function cancelBookingWithRefund(args) { const result = await cancelBooking(args); let refund = result.refund; if (!refund) { const booking = await prisma.booking.findFirst({ where: { id: args.bookingId, userId: args.userId } }); if (booking && booking.status === 'CANCELLED') refund = await prisma.refund.findFirst({ where: { bookingId: booking.id } }); } if (!refund || refund.status === 'succeeded' || refund.status === 'failed') return { ...result, refund }; const payment = await prisma.payment.findUnique({ where: { id: refund.paymentId } }); if (!payment || !payment.providerPaymentId) return { ...result, refund }; const { createRefund } = require('../payments/providers/razorpay'); const { minorUnits } = require('../payments/service'); try { const provider = await createRefund({ providerPaymentId: payment.providerPaymentId, amountMinor: minorUnits(refund.amount), idempotencyKey: refund.idempotencyKey }); await reconcileRefund(refund, payment, provider); return { ...result, refund: await prisma.refund.findUnique({ where: { id: refund.id } }) }; } catch (err) { if (!err.ambiguous) await prisma.refund.update({ where: { id: refund.id }, data: { status: 'failed', failedAt: new Date(), failureReason: 'Razorpay refund request failed.' } }); throw err; } }

const pickupNotFound = () => new AppError('Booking not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
const pickupDto = (booking, car, trip, replayed = false) => ({ bookingId: booking.id, bookingNumber: booking.bookingNumber, status: booking.status, carId: booking.carId, pickup: { time: trip.startTime, odometer: trip.startOdometer, fuelLevelPercent: Number(trip.startFuel) }, carStatus: car.status, replayed });
async function lockRow(tx, table, id) { if (tx.$queryRaw) await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id = ${id} FOR UPDATE`); }
async function lockTripHistory(tx, bookingId) { if (tx.$queryRaw) await tx.$queryRaw(Prisma.sql`SELECT id FROM trip_history WHERE booking_id = ${bookingId} FOR UPDATE`); }
function samePickup(trip, startOdometer, fuelLevelPercent, notes) { return trip && trip.startTime && trip.startOdometer === startOdometer && Number(trip.startFuel) === fuelLevelPercent && (trip.pickupNotes || undefined) === (notes || undefined); }

/** Internal testHooks are deliberately service-only and never accepted by HTTP. */
async function pickupBooking({ operatorId, bookingId, startOdometer, fuelLevelPercent, notes, superAdmin = false, testHooks }) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'bookings', bookingId);
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw pickupNotFound();
    if (!superAdmin) {
      const member = await tx.vendorMember.findFirst({ where: { vendorId: booking.vendorId, userId: operatorId } });
      if (!member) throw pickupNotFound();
    }
    await lockRow(tx, 'cars', booking.carId);
    const car = await tx.car.findUnique({ where: { id: booking.carId } });
    if (!car || car.vendorId !== booking.vendorId) throw conflict('Booking vehicle is invalid.');
    await lockTripHistory(tx, booking.id);
    const trip = await tx.tripHistory.findUnique({ where: { bookingId: booking.id } });
    if (booking.status === 'ACTIVE') {
      if (!trip || trip.tripStatus !== 'active' || !samePickup(trip, startOdometer, fuelLevelPercent, notes)) throw conflict('Pickup facts conflict with the active booking.');
      if (car.status !== 'busy') throw conflict('Active booking has an inconsistent vehicle state.');
      return pickupDto(booking, car, trip, true);
    }
    if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'succeeded') throw conflict('Booking is not eligible for pickup.');
    if (car.status !== 'available') throw conflict('Car is not available for pickup.');
    if (startOdometer < (car.odometer || 0)) throw new AppError('Start odometer cannot be below the trusted car odometer.', httpStatus.UNPROCESSABLE_ENTITY, errorCodes.VALIDATION_ERROR);
    if (trip && (trip.startTime || trip.tripStatus === 'archived')) throw conflict('Trip history is not eligible for pickup.');
    const now = new Date();
    const data = { startTime: now, startOdometer, startFuel: fuelLevelPercent, startedBy: operatorId, pickupNotes: notes || null, tripStatus: 'active' };
    const activeTrip = trip ? await tx.tripHistory.update({ where: { id: trip.id }, data }) : await tx.tripHistory.create({ data: { bookingId: booking.id, ...data } });
    const activeBooking = await tx.booking.update({ where: { id: booking.id }, data: { status: 'ACTIVE' } });
    const activeCar = await tx.car.update({ where: { id: car.id }, data: { status: 'busy', ...(startOdometer > (car.odometer || 0) ? { odometer: startOdometer } : {}) } });
    if (testHooks?.afterPickupMutation) await testHooks.afterPickupMutation({ tx, booking: activeBooking, car: activeCar, trip: activeTrip });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, fromStatus: 'CONFIRMED', toStatus: 'ACTIVE', changedBy: operatorId, reason: 'vehicle_picked_up' } });
    await tx.auditLog.create({ data: { userId: operatorId, action: 'booking.pickup.completed', module: 'bookings', entity: 'booking', entityId: booking.id, result: 'success', metadata: JSON.stringify({ bookingId: booking.id, carId: car.id, vendorId: booking.vendorId, fromStatus: 'CONFIRMED', toStatus: 'ACTIVE' }) } });
    return pickupDto(activeBooking, activeCar, activeTrip);
  });
}
module.exports = { createBooking, listMine, getMine, cancelBooking: cancelBookingWithRefund, cancelBookingForVerification: cancelBooking, pickupBooking, dto, reconcileRefund };
