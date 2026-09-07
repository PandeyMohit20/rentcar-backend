'use strict';
/* eslint-disable no-console */
const assert = require('assert/strict');
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/config/database');
const { createOrder, processWebhook } = require('../src/modules/payments/service');
const razorpay = require('../src/modules/payments/providers/razorpay');
const tag = `f6-race-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const counters = { iterations: 40, failures: 0, duplicateProviderOrders: 0, stateCorruption: 0, cleanupFailures: 0 };
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }
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
async function cleanup(f) { try { await prisma.refundWebhookEvent.deleteMany({ where: { refund: { bookingId: f.booking.id } } }); await prisma.refund.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.paymentWebhookEvent.deleteMany({ where: { paymentId: f.payment.id } }); await prisma.invoice.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.payment.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: f.booking.id } }); await prisma.booking.deleteMany({ where: { id: f.booking.id } }); await prisma.car.delete({ where: { id: f.car.id } }); await prisma.branch.delete({ where: { id: f.branch.id } }); await prisma.location.delete({ where: { id: f.location.id } }); await prisma.city.delete({ where: { id: f.city.id } }); await prisma.vendor.delete({ where: { id: f.vendor.id } }); await prisma.user.delete({ where: { id: f.user.id } }); } catch (err) { counters.cleanupFailures += 1; console.error(`cleanup failed: ${err.message}`); } }

async function run(index) {
  const f = await fixture(index);
  const originalTransaction = prisma.$transaction.bind(prisma);
  const originalCreate = razorpay.createOrder;
  const captured = deferred(); const release = deferred(); const orderWaiting = deferred();
  let providerCalls = 0; let captureTransaction = true;
  const operationalStatus = ['normal', 'review_required', 'late_payment_conflict'][index % 3];
  try {
    // A failed historical order is the retry-eligible state that made this race dangerous.
    await prisma.payment.update({ where: { id: f.payment.id }, data: { status: 'failed' } });
    razorpay.createOrder = async () => { providerCalls += 1; return { id: `order_unexpected_${index}` }; };
    prisma.$transaction = (work, options) => {
      const isCapture = captureTransaction; captureTransaction = false;
      return originalTransaction(async (tx) => {
        const wrapped = new Proxy(tx, { get(target, key) {
          if (key === '$queryRaw') return async (...args) => { if (!isCapture) orderWaiting.resolve(); return target.$queryRaw(...args); };
          if (key === 'payment' && isCapture) return new Proxy(target.payment, { get(model, method) {
            if (method === 'update') return async (...args) => { const result = await model.update(...args); captured.resolve(); await release.promise; return result; };
            return model[method];
          } });
          return target[key];
        } });
        return work(wrapped);
      }, options);
    };
    const capture = operationalStatus === 'late_payment_conflict'
      // Equivalent captured transition under the production car-lock discipline.
      ? prisma.$transaction(async (tx) => { await tx.$queryRaw(Prisma.sql`SELECT id FROM cars WHERE id = ${f.car.id} FOR UPDATE`); await tx.payment.update({ where: { id: f.payment.id }, data: { status: 'succeeded', operationalStatus, paidAt: new Date() } }); })
      : processWebhook({ eventId: `evt_${crypto.randomUUID()}`, rawBody: Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${crypto.randomUUID().replace(/-/g, '')}`, order_id: f.payment.providerOrderId, amount: operationalStatus === 'normal' ? 10000 : 9999, currency: 'INR' } } } })) });
    // Capture has mutated the payment while holding the lock; order is forced to wait.
    await captured.promise;
    const order = createOrder({ userId: f.user.id, bookingId: f.booking.id }).then(() => ({ accepted: true }), (error) => ({ error }));
    await orderWaiting.promise; release.resolve(); await capture;
    const result = await order;
    assert.equal(result.error?.statusCode, 409);
    const payment = await prisma.payment.findUnique({ where: { id: f.payment.id } });
    if (payment.status !== 'succeeded' || payment.operationalStatus !== operationalStatus) counters.stateCorruption += 1;
    counters.duplicateProviderOrders += providerCalls;
    assert.equal(await prisma.payment.count({ where: { bookingId: f.booking.id } }), 1);
  } finally {
    release.resolve(); prisma.$transaction = originalTransaction; razorpay.createOrder = originalCreate; await cleanup(f);
  }
}

async function runClaimGap(index) {
  const f = await fixture(index);
  const originalTransaction = prisma.$transaction.bind(prisma); const originalCreate = razorpay.createOrder;
  try {
    await prisma.payment.update({ where: { id: f.payment.id }, data: { status: 'failed' } });
    razorpay.createOrder = async () => { counters.duplicateProviderOrders += 1; return { id: `order_gap_${index}` }; };
    prisma.$transaction = async (work, options) => {
      const claim = await originalTransaction(work, options);
      prisma.$transaction = originalTransaction;
      // Capture wins precisely between committed local claim and provider phase.
      await processWebhook({ eventId: `evt_${crypto.randomUUID()}`, rawBody: Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${crypto.randomUUID().replace(/-/g, '')}`, order_id: f.payment.providerOrderId, amount: 9999, currency: 'INR' } } } })) });
      return claim;
    };
    await assert.rejects(createOrder({ userId: f.user.id, bookingId: f.booking.id }), { statusCode: 409 });
    const payment = await prisma.payment.findUnique({ where: { id: f.payment.id } });
    assert.equal(payment.status, 'succeeded'); assert.equal(payment.operationalStatus, 'review_required');
    assert.equal(await prisma.payment.count({ where: { bookingId: f.booking.id, providerOrderId: { not: null } } }), 1);
  } finally { prisma.$transaction = originalTransaction; razorpay.createOrder = originalCreate; await cleanup(f); }
}
(async () => {
  try {
    assert.equal(require('../src/config/env').env.TEST_DATABASE_MOCK, false);
    for (let i = 0; i < counters.iterations; i += 1) {
      try { await (i < 30 ? run(i) : runClaimGap(i)); } catch (error) { counters.failures += 1; console.error(error.message); }
    }
    console.log(JSON.stringify(counters));
    if (counters.failures || counters.duplicateProviderOrders || counters.stateCorruption || counters.cleanupFailures) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
