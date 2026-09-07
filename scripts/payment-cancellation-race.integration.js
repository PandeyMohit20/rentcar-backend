'use strict';
/* eslint-disable no-console */
const assert = require('assert/strict');
const crypto = require('crypto');
const { prisma } = require('../src/config/database');
const { cancelBooking } = require('../src/modules/bookings/service');
const { processWebhook } = require('../src/modules/payments/service');
const { checkCarAvailability } = require('../src/modules/availability/service');
const razorpay = require('../src/modules/payments/providers/razorpay');
const iterations = Math.max(50, Number.parseInt(process.env.RACE_ITERATIONS || '100', 10) || 100);
const counters = { iterations, cancellationFirst: 0, captureFirst: 0, simultaneous: 0, cancellationWins: 0, captureWins: 0,
  internalDeadlocks: 0, transactionRetries: 0, businessFailures: 0, invalidStates: 0, lostCapturedPayments: 0,
  duplicateRefunds: 0, confirmationResurrection: 0, duplicateHistory: 0, providerTransportCalls: 0,
  duplicateProviderAttempts: 0, cleanupFailures: 0 };
const tag = `p4c-race-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }
async function bounded(promise) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Race barrier timed out')), 3000); })]); } finally { clearTimeout(timer); } }
function capture(f, afterPaymentUpdate) { return processWebhook({ eventId: `evt_${crypto.randomUUID()}`, afterPaymentUpdate, rawBody: Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${f.payment.id.replace(/-/g, '')}`, order_id: f.payment.providerOrderId, amount: 10000, currency: 'INR' } } } })) }); }
// Hold a winner after its mutation until the loser attempts its real DB lock.
// Uses existing service-only rollback seams; no production hooks are added.
async function ordered(first, second) {
  const mutated = deferred(); const release = deferred(); const waiting = deferred();
  const original = prisma.$transaction.bind(prisma);
  const firstResult = Promise.allSettled([first(async () => { mutated.resolve(); await bounded(release.promise); })]);
  let secondResult;
  try {
    await bounded(mutated.promise);
    prisma.$transaction = (work, options) => original((tx) => work(new Proxy(tx, { get(target, key) {
      if (key === '$queryRaw') return (...args) => { waiting.resolve(); return target.$queryRaw(...args); };
      return target[key];
    } })), options);
    secondResult = Promise.allSettled([second()]);
    await bounded(waiting.promise);
  } finally { release.resolve(); prisma.$transaction = original; }
  return [...await firstResult, ...await secondResult];
}
async function fixture(index) {
  return prisma.$transaction(async (tx) => {
  const suffix = `${tag}-${index}`;
  const user = await tx.user.create({ data: { name: suffix, email: `${suffix}@example.test`, passwordHash: 'integration-only', status: 'active' } });
  const vendor = await tx.vendor.create({ data: { vendorCode: `${suffix}-v`, companyName: suffix, status: 'active' } });
  const city = await tx.city.create({ data: { name: suffix, status: 'active' } });
  const location = await tx.location.create({ data: { cityId: city.id, vendorId: vendor.id, name: suffix, status: 'active' } });
  const branch = await tx.branch.create({ data: { locationId: location.id, vendorId: vendor.id, name: suffix, status: 'active' } });
  const car = await tx.car.create({ data: { vendorId: vendor.id, branchId: branch.id, registrationNumber: `${suffix}-car`, brand: 'Race', model: 'Lock', manufacturingYear: 2025, status: 'available', isDeleted: false } });
  const startAt = new Date(Date.now() + 7 * 86400000); const endAt = new Date(startAt.getTime() + 3600000);
  const booking = await tx.booking.create({ data: { bookingNumber: `BK-${crypto.randomUUID().slice(0, 12)}`, userId: user.id, vendorId: vendor.id, carId: car.id, startAt, endAt, subtotal: 100, tax: 0, discount: 0, securityDeposit: 0, totalAmount: 100, currencyCode: 'INR', status: 'PAYMENT_PENDING', paymentStatus: 'pending', holdExpiresAt: new Date(Date.now() + 3600000), idempotencyKey: `${suffix}-booking`, idempotencyHash: 'a'.repeat(64) } });
  const payment = await tx.payment.create({ data: { bookingId: booking.id, userId: user.id, amount: 100, currencyCode: 'INR', provider: 'razorpay', providerOrderId: `order_${crypto.randomUUID().replace(/-/g, '')}`, status: 'pending' } });
  return { user, vendor, city, location, branch, car, booking, payment, startAt, endAt };
  });
}
async function cleanup(f) { try { await prisma.refundWebhookEvent.deleteMany({ where: { refund: { bookingId: f.booking.id } } }); await prisma.refund.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.paymentWebhookEvent.deleteMany({ where: { paymentId: f.payment.id } }); await prisma.invoice.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.payment.deleteMany({ where: { id: f.payment.id } }); await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.booking.deleteMany({ where: { id: f.booking.id } }); await prisma.car.delete({ where: { id: f.car.id } }); await prisma.branch.delete({ where: { id: f.branch.id } }); await prisma.location.delete({ where: { id: f.location.id } }); await prisma.city.delete({ where: { id: f.city.id } }); await prisma.vendor.delete({ where: { id: f.vendor.id } }); await prisma.user.delete({ where: { id: f.user.id } }); } catch (err) { counters.cleanupFailures += 1; console.error(`cleanup failed: ${err.message}`); } }

async function runRaceIteration(index) {
  const f = await fixture(index); const attempts = [];
  const originalRefund = razorpay.createRefund;
  razorpay.createRefund = async (args) => {
    attempts.push(args); counters.providerTransportCalls += 1;
    const durable = await prisma.refund.findFirst({ where: { bookingId: f.booking.id } });
    assert.equal(durable.idempotencyKey, args.idempotencyKey);
    assert.equal((await prisma.booking.findUnique({ where: { id: f.booking.id } })).status, 'CANCELLED');
    return { providerRefundId: `rfnd_${durable.id.replace(/-/g, '')}`, status: 'pending' };
  };
  try {
    const cancel = (hook) => cancelBooking({ userId: f.user.id, bookingId: f.booking.id, reason: 'race cancellation', idempotencyKey: `${tag}-cancel-${index}`, ...(hook ? { testHooks: { afterBookingMutation: hook } } : {}) });
    let settlements;
    if (index % 3 === 0) { counters.cancellationFirst += 1; settlements = await ordered((hook) => cancel(hook), () => capture(f)); }
    else if (index % 3 === 1) { counters.captureFirst += 1; settlements = await ordered((hook) => capture(f, hook), () => cancel()); }
    else { counters.simultaneous += 1; settlements = await Promise.allSettled([cancel(), capture(f)]); }
    for (const result of settlements) {
      if (result.status === 'rejected') {
        counters.businessFailures += 1;
        if (result.reason.code === 'P2034' || /1213|deadlock/i.test(result.reason.message)) counters.internalDeadlocks += 1;
        console.error(result.reason.message);
      }
    }
    const [booking, payment, refunds, histories, invoices, events] = await Promise.all([
      prisma.booking.findUnique({ where: { id: f.booking.id } }), prisma.payment.findUnique({ where: { id: f.payment.id } }),
      prisma.refund.findMany({ where: { bookingId: f.booking.id } }), prisma.bookingStatusHistory.findMany({ where: { bookingId: f.booking.id } }),
      prisma.invoice.findMany({ where: { bookingId: f.booking.id } }), prisma.paymentWebhookEvent.findMany({ where: { paymentId: f.payment.id } }),
    ]);
    const cancellations = histories.filter((h) => h.toStatus === 'CANCELLED'); const confirmations = histories.filter((h) => h.toStatus === 'CONFIRMED');
    if (!payment || payment.status !== 'succeeded' || !payment.paidAt || !payment.providerPaymentId) counters.lostCapturedPayments += 1;
    if (refunds.length > 1) counters.duplicateRefunds += 1;
    if (cancellations.length !== 1 || confirmations.length > 1) counters.duplicateHistory += 1;
    if (booking.status !== 'CANCELLED' && cancellations.length) counters.confirmationResurrection += 1;
    if (attempts.length > 1) counters.duplicateProviderAttempts += attempts.length - 1;
    assert.equal(booking.status, 'CANCELLED'); assert.ok(booking.cancelledAt); assert.equal(booking.cancellationReason, 'race cancellation');
    assert.equal(cancellations.length, 1); assert.equal(events.length, 1); assert.ok(events[0].processedAt);
    if (cancellations[0].fromStatus === 'PAYMENT_PENDING') {
      counters.cancellationWins += 1;
      assert.notEqual(index % 3, 1); assert.equal(booking.paymentStatus, 'pending');
      assert.equal(payment.operationalStatus, 'late_payment_conflict'); assert.equal(confirmations.length, 0);
      assert.equal(refunds.length, 0); assert.equal(invoices.length, 0); assert.equal(attempts.length, 0);
    } else {
      counters.captureWins += 1;
      assert.notEqual(index % 3, 0); assert.equal(cancellations[0].fromStatus, 'CONFIRMED');
      assert.equal(booking.paymentStatus, 'succeeded'); assert.equal(payment.operationalStatus, 'normal');
      assert.equal(confirmations.length, 1); assert.equal(refunds.length, 1); assert.equal(invoices.length, 1);
      assert.equal(refunds[0].paymentId, payment.id); assert.equal(String(refunds[0].amount), String(payment.amount));
      assert.equal(refunds[0].status, 'pending'); assert.ok(refunds[0].providerReference); assert.equal(attempts.length, 1);
    }
    assert.equal((await checkCarAvailability(f.car.id, f.startAt, f.endAt)).available, true);
  } catch (err) { counters.invalidStates += 1; console.error(`Iteration ${index + 1}: ${err.message}`); }
  finally { razorpay.createRefund = originalRefund; await cleanup(f); }
}
async function main() {
  assert.equal(require('../src/config/env').env.TEST_DATABASE_MOCK, false);
  const db = await prisma.$queryRaw`SELECT VERSION() AS version, @@transaction_isolation AS isolationLevel`;
  console.log('REAL MYSQL:', db);
  try { for (let index = 0; index < iterations; index += 1) await runRaceIteration(index); }
  finally { await prisma.$disconnect(); }
  console.log(JSON.stringify(counters, null, 2));
  const failures = ['internalDeadlocks', 'businessFailures', 'invalidStates', 'lostCapturedPayments', 'duplicateRefunds', 'confirmationResurrection', 'duplicateHistory', 'duplicateProviderAttempts', 'cleanupFailures'];
  const pass = failures.every((key) => counters[key] === 0) && counters.cancellationWins + counters.captureWins === iterations;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`); if (!pass) process.exitCode = 1;
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
