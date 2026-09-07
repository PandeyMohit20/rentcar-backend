'use strict';
jest.mock('../src/modules/payments/providers/razorpay', () => ({ createOrder: jest.fn(), verifyCheckoutSignature: jest.fn(), verifyWebhookSignature: jest.fn(), parseWebhookEvent: jest.fn() }));
const request = require('supertest'); const { createApp } = require('../src/app'); const { prisma, resetStore, seedUser } = require('./helpers/auth'); const { signAccessToken } = require('../src/utils/jwt'); const razorpay = require('../src/modules/payments/providers/razorpay'); 
async function booking(userId, data = {}) { const car = await prisma.car.create({ data: { vendorId: 'v', branchId: 'b', registrationNumber: `PAY-${Math.random()}`, brand: 'T', model: 'P', manufacturingYear: 2025, status: 'available' } }); return prisma.booking.create({ data: { bookingNumber: `BK-${Math.random()}`, userId, vendorId: 'v', carId: car.id, startAt: new Date('2030-01-10T00:00:00Z'), endAt: new Date('2030-01-11T00:00:00Z'), subtotal: 1000, securityDeposit: 234.5, totalAmount: 1234.5, currencyCode: 'INR', status: 'PAYMENT_PENDING', paymentStatus: 'pending', holdExpiresAt: new Date(Date.now() + 600000), ...data } }); }

describe('F6 payment recovery', () => {
  let app; let user; let token;
  beforeAll(() => { app = createApp(); });
  beforeEach(async () => { resetStore(); jest.clearAllMocks(); user = await seedUser({ email: 'f6@example.test' }); token = signAccessToken({ sub: user.id }); razorpay.createOrder.mockResolvedValue({ id: 'order_retry' }); });
  const order = (id) => request(app).post('/api/v1/payments/orders').set('Authorization', `Bearer ${token}`).send({ bookingId: id });
  const detail = (id) => request(app).get(`/api/v1/bookings/${id}`).set('Authorization', `Bearer ${token}`);
  async function payment(own, data = {}) { return prisma.payment.create({ data: { bookingId: own.id, userId: user.id, amount: 1234.5, currencyCode: 'INR', provider: 'razorpay', status: 'pending', operationalStatus: 'normal', providerOrderId: `order_${Math.random()}`, ...data } }); }
  it.each(['normal', 'review_required', 'late_payment_conflict'])('blocks captured %s even with newer pending/failed attempts, without mutations', async (operationalStatus) => {
    const own = await booking(user.id); const captured = await payment(own, { status: 'succeeded', operationalStatus, createdAt: new Date('2020-01-01') });
    await payment(own, { status: 'failed' }); await payment(own);
    const before = JSON.stringify(await prisma.payment.findMany({ where: { bookingId: own.id } }));
    expect((await order(own.id)).status).toBe(409); expect(razorpay.createOrder).not.toHaveBeenCalled();
    expect(JSON.stringify(await prisma.payment.findMany({ where: { bookingId: own.id } }))).toBe(before);
    expect(JSON.stringify(await prisma.booking.findUnique({ where: { id: own.id } }))).toBe(JSON.stringify(own));
    expect((await detail(own.id)).body.data.payment).toMatchObject({ id: captured.id, status: 'succeeded', operationalStatus });
  });
  it.each([{ status: 'processing', providerPaymentId: 'pay_evidence' }, { status: 'failed', paidAt: new Date() }, { status: 'refunded' }])('blocks persisted capture evidence %j', async (data) => {
    const own = await booking(user.id); await payment(own, data); expect((await order(own.id)).status).toBe(409); expect(razorpay.createOrder).not.toHaveBeenCalled();
  });
  it('preserves failed retry and processing order reuse', async () => {
    const own = await booking(user.id); await payment(own, { status: 'failed' });
    expect((await order(own.id)).status).toBe(201); expect(razorpay.createOrder).toHaveBeenCalledTimes(1);
    const active = await prisma.payment.findFirst({ where: { bookingId: own.id, status: 'pending' } });
    await prisma.payment.update({ where: { id: active.id }, data: { status: 'processing' } });
    expect((await order(own.id)).body.data.reused).toBe(true); expect(razorpay.createOrder).toHaveBeenCalledTimes(1);
  });
  it('returns null with no payment', async () => { const own = await booking(user.id); expect((await detail(own.id)).body.data.payment).toBeNull(); });
  it.each(['pending', 'processing', 'failed', 'cancelled', 'refunded'])('recovers %s with an exact safe whitelist and owner-protected payment followup', async (status) => {
    const own = await booking(user.id);
    const secrets = { providerPaymentId: 'pay_PRIVATE', transactionReference: 'tx_PRIVATE', providerReference: 'reference_PRIVATE', signature: 'signature_PRIVATE', idempotencyKey: 'key_PRIVATE', idempotencyHash: 'hash_PRIVATE', payloadHash: 'payload_PRIVATE', webhookEventId: 'event_PRIVATE', secret: 'secret_PRIVATE', bankAccount: 'bank_PRIVATE', failureReason: 'notes_PRIVATE' };
    const p = await payment(own, { status, ...secrets });
    const result = await detail(own.id); expect(result.status).toBe(200);
    expect(Object.keys(result.body.data.payment).sort()).toEqual(['id', 'status', 'operationalStatus', 'amount', 'currencyCode', 'createdAt', 'updatedAt'].sort());
    expect(result.body.data.payment).toMatchObject({ id: p.id, status, amount: 1234.5, currencyCode: 'INR' });
    const json = JSON.stringify(result.body); for (const [key, value] of Object.entries(secrets)) { expect(json).not.toContain(key); expect(json).not.toContain(value); }
    expect(json).not.toContain('providerOrderId');
    expect((await request(app).get(`/api/v1/payments/${p.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    const other = await seedUser({ email: 'f6-other@example.test' }); const otherToken = signAccessToken({ sub: other.id });
    const denied = await request(app).get(`/api/v1/bookings/${own.id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(denied.status).toBe(404); expect(JSON.stringify(denied.body)).not.toContain(p.id);
    expect((await request(app).get(`/api/v1/payments/${p.id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(404);
  });
  it('selects monetary tiers, active over history, and deterministic newest ties', () => {
    const { selectAuthoritativePayment: select } = require('../src/modules/payments/recovery');
    const rows = [ { id: 'failed', status: 'failed' }, { id: 'active', status: 'processing' }, { id: 'refund', status: 'refunded' }, { id: 'paid', status: 'succeeded' }, { id: 'review', status: 'succeeded', operationalStatus: 'review_required' } ].map((p, i) => ({ ...p, createdAt: new Date(2030 - i, 0) }));
    while (rows.length) { expect(select(rows).id).toBe(rows[rows.length - 1].id); rows.pop(); }
    expect(select([{ id: 'a', status: 'pending', createdAt: new Date(0) }, { id: 'b', status: 'pending', createdAt: new Date(0) }]).id).toBe('b');
  });
});
