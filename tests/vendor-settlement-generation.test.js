'use strict';
const crypto = require('crypto');
const { prisma, resetStore, seedRole, seedUser } = require('./helpers/auth');
const { settlementFixture } = require('./helpers/settlement');
const { generateSettlement, bodySchema, keySchema } = require('../src/modules/vendors/settlementGeneration');
const { financialTransaction, retryTransaction } = require('../src/modules/vendors/settlementFinancialGuard');
const { previewVendorSettlements } = require('../src/modules/vendors/settlementPreview');
const request = require('supertest');
const { createApp } = require('../src/app');
const { signAccessToken } = require('../src/utils/jwt');
let f;
const generate = (body = {}, key = 'private-key') => generateSettlement(f.actor, f.vendor.id, { bookingIds: [f.booking.id], currencyCode: 'INR', ...body }, key);
beforeEach(async () => { resetStore(); f = await settlementFixture(prisma); });
afterEach(() => jest.restoreAllMocks());

it('creates exact approved GST-inclusive earnings, excluding deposit and ignoring current rate', async () => {
  const result = await generate();
  expect(result).toMatchObject({ replayed: false, settlement: { netPayable: '38016.00', grossCollected: '51536.00', securityDeposit: '10000.00', commissionAmount: '3520.00', status: 'pending', bankAccount: null, requiresFinancialReview: false, itemCount: 1 } });
  expect(result.settlement.settlementNumber).toMatch(/^VS-[0-9a-f-]{36}$/);
  expect(result.settlement.periodStart).toEqual(f.trip.endTime);
  expect(await prisma.auditLog.count({ where: { action: 'vendor.settlement.generate' } })).toBe(1);
  expect(JSON.stringify(result)).not.toMatch(/private-key|idempotencyKeyHash|requestHash|provider/);
  expect(JSON.stringify(prisma.$store)).not.toContain('private-key');
});
it('preview and generation agree on supported production eligibility and net', async () => {
  const p = await previewVendorSettlements(f.actor, f.vendor.id);
  expect(p.data.bookings[0]).toMatchObject({ generationReady: true, netPayable: '38016.00', blockers: [] });
  expect((await generate()).settlement.netPayable).toBe(p.data.bookings[0].netPayable);
});
it('replays normalized currency/key with no new items/audit', async () => {
  const a = await generate(); const b = await generate({ currencyCode: ' inr ' }, ' private-key ');
  expect(b.replayed).toBe(true); expect(b.settlement.id).toBe(a.settlement.id);
  expect(await prisma.vendorSettlement.count()).toBe(1); expect(await prisma.vendorSettlementItem.count()).toBe(1);
  expect(await prisma.auditLog.count()).toBe(1);
});
it('same key with a different valid booking set conflicts', async () => {
  await generate(); await expect(generate({ bookingIds: [crypto.randomUUID()] })).rejects.toMatchObject({ code: 'SETTLEMENT_IDEMPOTENCY_CONFLICT' });
});
it.each([undefined, '', ' ', 'a'.repeat(201), 'a\nb'])('rejects invalid key %j', (key) => { expect(keySchema.safeParse(key).success).toBe(false); });
it.each([{}, { bookingIds: [], currencyCode: 'INR' }, { bookingIds: ['invalid'], currencyCode: 'INR' },
  { bookingIds: Array.from({ length: 101 }, () => crypto.randomUUID()), currencyCode: 'INR' },
  { bookingIds: [crypto.randomUUID()], currencyCode: 'US$' }, { bookingIds: [crypto.randomUUID()] },
])('rejects invalid contract case %#', (body) => { expect(bodySchema.safeParse(body).success).toBe(false); });
it('rejects duplicate IDs and unknown client financial fields', () => {
  expect(bodySchema.safeParse({ bookingIds: [f.booking.id, f.booking.id], currencyCode: 'INR' }).success).toBe(false);
  expect(bodySchema.safeParse({ bookingIds: [f.booking.id], currencyCode: 'INR', netPayable: 1 }).success).toBe(false);
});
it.each([
  ['status', 'ACTIVE'], ['vendorId', crypto.randomUUID()], ['financialSnapshot', null],
  ['vendorCommissionRate', null], ['vendorCommision', null], ['subtotal', '1'], ['tax', '-1'], ['discount', '1'], ['paymentStatus', 'refunded'],
])('rejects booking %s=%j atomically', async (field, value) => {
  await prisma.booking.update({ where: { id: f.booking.id }, data: { [field]: value } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
  expect(await prisma.vendorSettlement.count()).toBe(0); expect(await prisma.vendorSettlementItem.count()).toBe(0);
});
it.each([['status', 'failed'], ['operationalStatus', 'review_required'], ['currencyCode', 'USD'], ['amount', '1'], ['paidAt', null], ['userId', crypto.randomUUID()]])('rejects payment %s=%j', async (field, value) => {
  await prisma.payment.update({ where: { id: f.payment.id }, data: { [field]: value } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
});
it.each(['pending', 'processing', 'succeeded', 'failed', 'cancelled'])('any refund status %s blocks initial generation', async (status) => {
  await prisma.refund.create({ data: { bookingId: f.booking.id, paymentId: f.payment.id, amount: '1.00', currencyCode: 'INR', status } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
});
it.each(['active', 'scheduled'])('rejects nonarchived trip %s', async (tripStatus) => {
  await prisma.tripHistory.update({ where: { id: f.trip.id }, data: { tripStatus } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
});
it('rejects missing completion and multiple captures', async () => {
  await prisma.tripHistory.update({ where: { id: f.trip.id }, data: { endTime: null } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
  await prisma.tripHistory.update({ where: { id: f.trip.id }, data: { endTime: f.trip.endTime } });
  await prisma.payment.create({ data: { ...f.payment, id: crypto.randomUUID(), providerOrderId: 'other-order', providerPaymentId: 'other-payment' } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
});
it('rejects missing booking, missing payment and unresolved audit', async () => {
  await expect(generate({ bookingIds: [crypto.randomUUID()] })).rejects.toMatchObject({ code: 'SETTLEMENT_BOOKING_MISSING' });
  await prisma.auditLog.create({ data: { action: 'payment.reconcile', entityId: f.booking.id, result: 'error', metadata: '{}' } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
  for (const row of await prisma.auditLog.findMany()) await prisma.auditLog.delete({ where: { id: row.id } });
  await prisma.payment.delete({ where: { id: f.payment.id } });
  await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
});
it.each(['vendorSettlementItem', 'auditLog'])('rolls back header/items on %s failure', async (model) => {
  jest.spyOn(prisma[model], 'create').mockRejectedValueOnce(new Error('injected failure'));
  await expect(generate()).rejects.toThrow('injected failure');
  expect(await prisma.vendorSettlement.count()).toBe(0); expect(await prisma.vendorSettlementItem.count()).toBe(0);
});
it('does not retry semantic failures; retries only bounded database conflicts', async () => {
  const work = jest.fn().mockRejectedValue({ code: 'P2034' }); await expect(retryTransaction(work)).rejects.toEqual({ code: 'P2034' }); expect(work).toHaveBeenCalledTimes(3);
  const semantic = jest.fn().mockRejectedValue({ code: 'SETTLEMENT_BOOKING_INELIGIBLE' }); await expect(retryTransaction(semantic)).rejects.toBeDefined(); expect(semantic).toHaveBeenCalledTimes(1);
});
it('preserves later financial truth and immutable pending snapshot', async () => {
  const result = await generate();
  await financialTransaction(prisma, f.booking.id, 'REFUND_CREATED', (tx) => tx.refund.create({ data: { bookingId: f.booking.id, paymentId: f.payment.id, amount: '1.00', currencyCode: 'INR', status: 'pending' } }));
  const refund = await prisma.refund.findFirst({ where: { bookingId: f.booking.id } });
  await require('../src/modules/refunds/service').reconcileProviderResult(refund, { providerRefundId: 'test-refund', status: 'processed' });
  const header = await prisma.vendorSettlement.findUnique({ where: { id: result.settlement.id } });
  expect(header).toMatchObject({ status: 'pending', netPayable: '38016.00', requiresFinancialReview: true, financialReviewReason: 'REFUND_CREATED' });
  expect((await prisma.refund.findUnique({ where: { id: refund.id } })).status).toBe('succeeded');
});
it('enforces HTTP auth independently from vendor membership', async () => {
  const app = createApp(); const url = `/api/v1/vendors/${f.vendor.id}/settlements`;
  const body = { bookingIds: [f.booking.id], currencyCode: 'INR' };
  expect((await request(app).post(url).send(body)).status).toBe(401);
  for (const [role, permissions, status] of [['MEMBER', ['vendors.view'], 403], ['LIMITED_ADMIN', ['vendors.update'], 403], ['SUPER_ADMIN', [], 201]]) {
    await seedRole(role, { permissions }); const user = await seedUser({ email: `${crypto.randomUUID()}@example.test`, roles: [role] });
    await prisma.vendorMember.create({ data: { vendorId: f.vendor.id, userId: user.id } });
    const response = await request(app).post(url).set('Authorization', `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}`).set('Idempotency-Key', 'http-test').send(body);
    expect(response.status).toBe(status);
  }
});

async function secondBooking(changes = {}) {
  const booking = await prisma.booking.create({ data: { ...f.booking, id: crypto.randomUUID(), bookingNumber: `BK-${crypto.randomUUID()}`, ...changes } });
  await prisma.payment.create({ data: { ...f.payment, id: crypto.randomUUID(), bookingId: booking.id, providerOrderId: `order-${crypto.randomUUID()}`, providerPaymentId: `pay-${crypto.randomUUID()}` } });
  await prisma.tripHistory.create({ data: { ...f.trip, id: crypto.randomUUID(), bookingId: booking.id, endTime: new Date('2026-01-03') } });
  return booking;
}
it('sums multiple bookings and replays reversed order; period uses actual ends', async () => {
  const b = await secondBooking();
  const a = await generate({ bookingIds: [f.booking.id, b.id] });
  const replay = await generate({ bookingIds: [b.id, f.booking.id], currencyCode: 'inr' });
  expect(a.settlement).toMatchObject({ netPayable: '76032.00', securityDeposit: '20000.00', grossCollected: '103072.00', itemCount: 2 });
  expect(a.settlement.periodStart).toEqual(new Date('2026-01-02'));
  expect(a.settlement.periodEnd).toEqual(new Date('2026-01-03'));
  expect(replay.settlement.id).toBe(a.settlement.id);
  expect(await prisma.auditLog.count()).toBe(1);
});
it('one bad booking rejects the entire batch without ledger rows', async () => {
  const b = await secondBooking({ vendorCommision: null });
  await expect(generate({ bookingIds: [f.booking.id, b.id] })).rejects.toMatchObject({ statusCode: 409 });
  expect(await prisma.vendorSettlement.count()).toBe(0); expect(await prisma.vendorSettlementItem.count()).toBe(0);
});
it('preserves decimal precision using stored commission even when rate differs', async () => {
  const financialSnapshot = { ...f.booking.financialSnapshot, rentalSubtotal: '0.30', taxableAmount: '0.30', securityDeposit: '0.10', grandTotal: '0.45', tax: { ...f.booking.financialSnapshot.tax, igst: '0.05', totalTax: '0.05' } };
  await prisma.booking.update({ where: { id: f.booking.id }, data: { subtotal: '0.30', tax: '0.05', securityDeposit: '0.10', totalAmount: '0.45', vendorCommision: '0.01', financialSnapshot } });
  await prisma.payment.update({ where: { id: f.payment.id }, data: { amount: '0.45' } });
  expect((await generate()).settlement.netPayable).toBe('0.34');
});
it('rejects unrelated P2002 without claiming idempotent success', async () => {
  jest.spyOn(prisma.vendorSettlement, 'create').mockRejectedValueOnce({ code: 'P2002', meta: { target: ['settlementNumber'] } });
  await expect(generate()).rejects.toMatchObject({ code: 'SETTLEMENT_UNIQUE_CONFLICT' });
  expect(await prisma.vendorSettlement.count()).toBe(0);
});
it('existing association under a different key cannot be reassigned', async () => {
  await generate(); await expect(generate({}, 'different')).rejects.toMatchObject({ code: 'SETTLEMENT_BOOKING_INELIGIBLE' });
  expect(await prisma.vendorSettlementItem.count()).toBe(1);
});
it('same key is scoped independently by vendor', async () => {
  const a = await generate(); const other = await settlementFixture(prisma);
  const b = await generateSettlement(other.actor, other.vendor.id, { bookingIds: [other.booking.id], currencyCode: 'INR' }, 'private-key');
  expect(a.settlement.id).not.toBe(b.settlement.id);
});
it('new generation never invokes provider or fetch', async () => {
  const provider = require('../src/modules/payments/providers/razorpay');
  const spies = ['createOrder', 'createRefund', 'fetchOrderState', 'fetchPaymentState'].map((method) => jest.spyOn(provider, method).mockImplementation(() => { throw new Error('forbidden provider call'); }));
  const fetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('forbidden network call'));
  await generate(); spies.forEach((spy) => expect(spy).not.toHaveBeenCalled()); expect(fetch).not.toHaveBeenCalled();
});
it('later capture correction preserves snapshot and review is sticky', async () => {
  const a = await generate();
  await require('../src/modules/payments/service').processWebhook({ eventId: crypto.randomUUID(), rawBody: Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: f.payment.providerPaymentId, order_id: f.payment.providerOrderId, amount: 1, currency: 'INR' } } } })) });
  expect(await prisma.vendorSettlement.findUnique({ where: { id: a.settlement.id } })).toMatchObject({ status: 'pending', requiresFinancialReview: true, netPayable: '38016.00' });
  expect((await prisma.payment.findUnique({ where: { id: f.payment.id } })).operationalStatus).toBe('review_required');
});

it('same key with a different currency conflicts before re-evaluating eligibility', async () => {
  await generate(); await expect(generate({ currencyCode: 'USD' })).rejects.toMatchObject({ code: 'SETTLEMENT_IDEMPOTENCY_CONFLICT' });
});

it('relevant P2002 reads back a committed concurrent winner and returns replay', async () => {
  const tx = jest.spyOn(prisma, '$transaction');
  tx.mockImplementationOnce(async () => {
    tx.mockRestore();
    await generate();
    throw { code: 'P2002', meta: { target: 'vendor_settlements_vendor_id_idempotency_key_hash_key' } };
  });
  const result = await generate(); expect(result.replayed).toBe(true);
  expect(await prisma.vendorSettlement.count()).toBe(1); expect(await prisma.vendorSettlementItem.count()).toBe(1); expect(await prisma.auditLog.count()).toBe(1);
});
it('relevant P2002 with a different committed request returns conflict', async () => {
  const b = await secondBooking();
  const tx = jest.spyOn(prisma, '$transaction');
  tx.mockImplementationOnce(async () => {
    tx.mockRestore(); await generate({ bookingIds: [b.id] });
    throw { code: 'P2002', meta: { target: ['vendorId', 'idempotencyKeyHash'] } };
  });
  await expect(generate()).rejects.toMatchObject({ code: 'SETTLEMENT_IDEMPOTENCY_CONFLICT' });
  expect(await prisma.vendorSettlement.count()).toBe(1);
});
it('duplicate pair constraint aborts the full transaction', async () => {
  const create = prisma.vendorSettlementItem.create;
  jest.spyOn(prisma.vendorSettlementItem, 'create').mockImplementationOnce(async (args) => {
    await create(args); return create(args);
  });
  await expect(generate()).rejects.toMatchObject({ code: 'SETTLEMENT_UNIQUE_CONFLICT' });
  expect(await prisma.vendorSettlement.count()).toBe(0); expect(await prisma.vendorSettlementItem.count()).toBe(0);
});
it('HTTP admin.all validates missing key and does not echo it on success', async () => {
  const app = createApp(); await seedRole('GENERATION_ADMIN', { permissions: ['admin.all'] });
  const user = await seedUser({ email: `${crypto.randomUUID()}@example.test`, roles: ['GENERATION_ADMIN'] });
  const send = () => request(app).post(`/api/v1/vendors/${f.vendor.id}/settlements`).set('Authorization', `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}`);
  const body = { bookingIds: [f.booking.id], currencyCode: 'INR' };
  expect((await send().send(body)).status).toBe(422);
  const response = await send().set('Idempotency-Key', 'private-http-key').send(body);
  expect(response.status).toBe(201); expect(JSON.stringify(response.body)).not.toMatch(/private-http-key|idempotencyKeyHash|requestHash/);
});
