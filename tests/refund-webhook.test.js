'use strict';

jest.mock('../src/modules/payments/providers/razorpay', () => ({
  createOrder: jest.fn(), createRefund: jest.fn(), verifyCheckoutSignature: jest.fn(),
  verifyWebhookSignature: jest.fn(), parseWebhookEvent: jest.fn(),
}));

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const razorpay = require('../src/modules/payments/providers/razorpay');

async function fixture() {
  const user = await seedUser({ email: `refund-webhook-${Math.random()}@example.test` });
  const booking = await prisma.booking.create({ data: { bookingNumber: `RF-${Math.random()}`, userId: user.id, vendorId: 'vendor', carId: 'car', startAt: new Date('2030-01-01'), endAt: new Date('2030-01-02'), subtotal: 100, totalAmount: 100, currencyCode: 'INR', status: 'CANCELLED', paymentStatus: 'succeeded' } });
  const payment = await prisma.payment.create({ data: { bookingId: booking.id, userId: user.id, amount: 100, currencyCode: 'INR', provider: 'razorpay', providerOrderId: `order_${booking.id}`, providerPaymentId: `pay_${booking.id}`, status: 'succeeded' } });
  const refund = await prisma.refund.create({ data: { bookingId: booking.id, paymentId: payment.id, amount: 100, currencyCode: 'INR', provider: 'razorpay', providerReference: `rfnd_${booking.id}`, idempotencyKey: `refund_key_${booking.id.replace(/-/g, '')}`, status: 'pending' } });
  return { booking, payment, refund };
}

function payload(refund, payment, event = 'refund.processed', changes = {}) {
  return { event, payload: { refund: { entity: { id: refund.providerReference, payment_id: payment.providerPaymentId, amount: 10000, currency: 'INR', ...changes } } } };
}

describe('Razorpay refund webhook reconciliation', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    resetStore(); jest.clearAllMocks();
    razorpay.verifyWebhookSignature.mockImplementation((raw, signature) => Buffer.isBuffer(raw) && signature === 'good');
    razorpay.parseWebhookEvent.mockImplementation((raw) => JSON.parse(raw.toString('utf8')));
  });
  const post = (body, eventId = 'refund_evt_1', signature = 'good') => request(app).post('/api/v1/payments/webhook/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).set('X-Razorpay-Event-Id', eventId).send(JSON.stringify(body));

  it('verifies the raw signature before parsing or mutating refund records', async () => {
    const f = await fixture();
    const response = await post(payload(f.refund, f.payment), 'refund_bad', 'bad');
    expect(response.status).toBe(400);
    expect(razorpay.parseWebhookEvent).not.toHaveBeenCalled();
    expect(await prisma.refundWebhookEvent.count()).toBe(0);
    expect((await prisma.refund.findUnique({ where: { id: f.refund.id } })).status).toBe('pending');
  });

  it('reconciles a matching processed event atomically and deduplicates its event ID', async () => {
    const f = await fixture(); const body = payload(f.refund, f.payment);
    expect((await post(body)).status).toBe(200);
    expect((await post(body)).body.data).toEqual({ duplicate: true });
    expect((await prisma.refund.findUnique({ where: { id: f.refund.id } })).status).toBe('succeeded');
    expect((await prisma.payment.findUnique({ where: { id: f.payment.id } })).status).toBe('refunded');
    expect((await prisma.booking.findUnique({ where: { id: f.booking.id } })).paymentStatus).toBe('refunded');
    const stored = await prisma.refundWebhookEvent.findFirst();
    expect(stored).toMatchObject({ provider: 'razorpay', providerEventId: 'refund_evt_1', refundId: f.refund.id });
    expect(stored.payloadHash).toHaveLength(64); expect(stored.processedAt).toBeTruthy();
  });

  it('never settles a refund when provider payment, exact amount, or currency does not match', async () => {
    const f = await fixture();
    for (const [eventId, changes] of [['refund_amount', { amount: 9999 }], ['refund_currency', { currency: 'USD' }], ['refund_payment', { payment_id: 'pay_other' }]]) {
      const response = await post(payload(f.refund, f.payment, 'refund.processed', changes), eventId);
      expect(response.status).toBe(200); expect(response.body.data.reconciliationMismatch).toBe(true);
    }
    expect((await prisma.refund.findUnique({ where: { id: f.refund.id } })).status).toBe('pending');
    expect((await prisma.payment.findUnique({ where: { id: f.payment.id } })).status).toBe('succeeded');
  });

  it('safely acknowledges unknown refund IDs and concurrent duplicate deliveries', async () => {
    const f = await fixture();
    expect((await post(payload(f.refund, f.payment, 'refund.processed', { id: 'rfnd_unknown' }), 'refund_unknown')).body.data.ignored).toBe(true);
    const body = payload(f.refund, f.payment);
    const responses = await Promise.all([post(body, 'refund_concurrent'), post(body, 'refund_concurrent')]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await prisma.refundWebhookEvent.count({ where: { providerEventId: 'refund_concurrent' } })).toBe(1);
  });

  it('records a valid failure without refunding the payment or changing booking payment status', async () => {
    const f = await fixture();
    await post(payload(f.refund, f.payment, 'refund.failed', { error_description: 'declined\nraw details omitted' }), 'refund_failed_first');
    const refund = await prisma.refund.findUnique({ where: { id: f.refund.id } });
    expect(refund).toMatchObject({ status: 'failed', failureReason: 'declined raw details omitted' });
    expect((await prisma.payment.findUnique({ where: { id: f.payment.id } })).status).toBe('succeeded');
    expect((await prisma.booking.findUnique({ where: { id: f.booking.id } })).paymentStatus).toBe('succeeded');
  });

  it('treats created as non-financial and refuses to downgrade a processed refund with a later failure', async () => {
    const f = await fixture();
    await post(payload(f.refund, f.payment, 'refund.created'), 'refund_created');
    expect((await prisma.refund.findUnique({ where: { id: f.refund.id } })).status).toBe('pending');
    await post(payload(f.refund, f.payment, 'refund.processed'), 'refund_processed');
    await post(payload(f.refund, f.payment, 'refund.failed', { error_description: 'late failure' }), 'refund_failed');
    const refund = await prisma.refund.findUnique({ where: { id: f.refund.id } });
    expect(refund.status).toBe('succeeded'); expect(refund.failureReason).toBeUndefined();
  });
});
