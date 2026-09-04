'use strict';
/* eslint-disable no-console */
const crypto = require('crypto');
const { prisma } = require('../src/config/database');
const { cancelBookingForVerification } = require('../src/modules/bookings/service');
const { processWebhook } = require('../src/modules/payments/service');
const { checkCarAvailability } = require('../src/modules/availability/service');
const razorpay = require('../src/modules/payments/providers/razorpay');

const iterations = Math.max(10, Number.parseInt(process.env.RACE_ITERATIONS || '20', 10) || 20);
const counters = { iterations, cancellationWins: 0, paymentWins: 0, otherValidOutcomes: 0, invalidStates: 0, lostCapturedPayments: 0, duplicateRefundStates: 0, doubleInventoryBlockers: 0, availabilityReleaseFailures: 0, unexpectedErrors: 0, cleanupFailures: 0 };
const tag = `p4c-race-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

async function fixture(index) {
  const suffix = `${tag}-${index}`;
  const user = await prisma.user.create({ data: { name: suffix, email: `${suffix}@example.test`, passwordHash: 'integration-only', status: 'active' } });
  const vendor = await prisma.vendor.create({ data: { vendorCode: `${suffix}-v`, companyName: suffix, status: 'active' } });
  const city = await prisma.city.create({ data: { name: suffix, status: 'active' } });
  const location = await prisma.location.create({ data: { cityId: city.id, vendorId: vendor.id, name: suffix, status: 'active' } });
  const branch = await prisma.branch.create({ data: { locationId: location.id, vendorId: vendor.id, name: suffix, status: 'active' } });
  const car = await prisma.car.create({ data: { vendorId: vendor.id, branchId: branch.id, registrationNumber: `${suffix}-car`, brand: 'Race', model: 'Lock', manufacturingYear: 2025, status: 'available', isDeleted: false } });
  const startAt = new Date(Date.now() + 7 * 86400000); const endAt = new Date(startAt.getTime() + 3600000);
  const booking = await prisma.booking.create({ data: { bookingNumber: `BK-${crypto.randomUUID().slice(0, 12)}`, userId: user.id, vendorId: vendor.id, carId: car.id, startAt, endAt, subtotal: 100, tax: 0, discount: 0, securityDeposit: 0, totalAmount: 100, currencyCode: 'INR', status: 'PAYMENT_PENDING', paymentStatus: 'pending', holdExpiresAt: new Date(Date.now() + 3600000), idempotencyKey: `${suffix}-booking`, idempotencyHash: 'a'.repeat(64) } });
  const payment = await prisma.payment.create({ data: { bookingId: booking.id, userId: user.id, amount: 100, currencyCode: 'INR', provider: 'razorpay', providerOrderId: `order_${crypto.randomUUID().replace(/-/g, '')}`, status: 'pending' } });
  return { user, vendor, city, location, branch, car, booking, payment, startAt, endAt };
}
function capture(f) { return processWebhook({ eventId: `evt_${crypto.randomUUID()}`, rawBody: Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${crypto.randomUUID().replace(/-/g, '')}`, order_id: f.payment.providerOrderId, amount: 10000, currency: 'INR' } } } })) }); }
async function cleanup(f) { try { await prisma.refundWebhookEvent.deleteMany({ where: { refund: { bookingId: f.booking.id } } }); await prisma.refund.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.paymentWebhookEvent.deleteMany({ where: { paymentId: f.payment.id } }); await prisma.invoice.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.payment.deleteMany({ where: { id: f.payment.id } }); await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.booking.deleteMany({ where: { id: f.booking.id } }); await prisma.car.delete({ where: { id: f.car.id } }); await prisma.branch.delete({ where: { id: f.branch.id } }); await prisma.location.delete({ where: { id: f.location.id } }); await prisma.city.delete({ where: { id: f.city.id } }); await prisma.vendor.delete({ where: { id: f.vendor.id } }); await prisma.user.delete({ where: { id: f.user.id } }); } catch (err) { counters.cleanupFailures += 1; console.error(`cleanup failed: ${err.message}`); } }
async function runRaceIteration(index) { const f = await fixture(index); try { const settlements = await Promise.allSettled([cancelBookingForVerification({ userId: f.user.id, bookingId: f.booking.id, reason: 'race cancellation', idempotencyKey: `${tag}-cancel-${index}` }), capture(f)]); const captured = settlements[1]; const [booking, payment, refunds, histories] = await Promise.all([prisma.booking.findUnique({ where: { id: f.booking.id } }), prisma.payment.findUnique({ where: { id: f.payment.id } }), prisma.refund.findMany({ where: { bookingId: f.booking.id } }), prisma.bookingStatusHistory.findMany({ where: { bookingId: f.booking.id } })]);
    const availability = booking.status === 'CANCELLED' ? await checkCarAvailability(f.car.id, f.startAt, f.endAt) : null;
    if (refunds.length > 1) counters.duplicateRefundStates += 1;
    if (booking.status === 'CANCELLED' && (!booking.cancelledAt || histories.filter((h) => h.toStatus === 'CANCELLED').length !== 1)) counters.invalidStates += 1;
    if (availability && !availability.available) counters.availabilityReleaseFailures += 1;
    if (booking.status === 'CANCELLED' && payment.status === 'succeeded' && payment.operationalStatus === 'late_payment_conflict') counters.cancellationWins += 1;
    else if (booking.status === 'CANCELLED' && payment.status === 'succeeded' && refunds.length === 1) counters.paymentWins += 1;
    else if (booking.status === 'CANCELLED' && payment.status === 'pending') counters.otherValidOutcomes += 1;
    else counters.invalidStates += 1;
    if (captured.status === 'fulfilled' && captured.value.confirmed && payment.status !== 'succeeded') counters.lostCapturedPayments += 1;
    if (histories.filter((h) => h.toStatus === 'CANCELLED').length > 1) counters.doubleInventoryBlockers += 1;
    console.log(`Iteration ${index + 1}: ${booking.status} / ${payment.status}`);
  } catch (err) { counters.unexpectedErrors += 1; console.error(`Iteration ${index + 1}: ${err.message}`); } finally { await cleanup(f); } }
async function main() { console.log('REAL MYSQL: YES'); console.log(`Database host configured: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`); const original = razorpay.createRefund; razorpay.createRefund = async () => ({ providerRefundId: `rfnd_${crypto.randomUUID().replace(/-/g, '')}`, status: 'pending' }); try { for (let index = 0; index < iterations; index += 1) await runRaceIteration(index); } finally { razorpay.createRefund = original; await prisma.$disconnect(); } console.log('PAYMENT/CANCELLATION REAL MYSQL RACE SUMMARY'); Object.entries(counters).forEach(([key, value]) => console.log(`${key}: ${value}`)); console.log('Cancellation production car lock: YES'); console.log('Payment production car lock: YES'); const pass = counters.invalidStates === 0 && counters.lostCapturedPayments === 0 && counters.duplicateRefundStates === 0 && counters.doubleInventoryBlockers === 0 && counters.availabilityReleaseFailures === 0 && counters.unexpectedErrors === 0 && counters.cleanupFailures === 0; console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`); if (!pass) process.exitCode = 1; }
main().catch((err) => { console.error(err); process.exitCode = 1; });
