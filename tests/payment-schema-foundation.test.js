'use strict';

const { prisma, resetStore } = require('./helpers/auth');

function legacyPayment(data = {}) {
  return {
    bookingId: data.bookingId || '00000000-0000-4000-8000-000000000001',
    userId: data.userId || '00000000-0000-4000-8000-000000000002',
    amount: data.amount || 1234.5,
    currencyCode: 'INR',
    paymentMethod: 'upi',
    provider: 'razorpay',
    status: 'pending',
    ...data,
  };
}

describe('Payment webhook persistence foundation', () => {
  beforeEach(() => resetStore());

  it('persists a Razorpay order while its payment ID is still null', async () => {
    const payment = await prisma.payment.create({
      data: legacyPayment({ providerOrderId: 'order_pending_1', providerPaymentId: null }),
    });
    expect(payment.providerOrderId).toBe('order_pending_1');
    expect(payment.providerPaymentId).toBeNull();
    expect(payment.operationalStatus).toBe('normal');
  });

  it('enforces unique provider order and provider payment identifiers', async () => {
    await prisma.payment.create({ data: legacyPayment({ providerOrderId: 'order_unique', providerPaymentId: 'pay_unique' }) });
    await expect(prisma.payment.create({ data: legacyPayment({ bookingId: 'b2', providerOrderId: 'order_unique' }) })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.payment.create({ data: legacyPayment({ bookingId: 'b3', providerPaymentId: 'pay_unique' }) })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('keeps legacy payment records compatible and represents a late-payment conflict separately from money status', async () => {
    const legacy = await prisma.payment.create({ data: legacyPayment({ provider: null }) });
    const late = await prisma.payment.create({
      data: legacyPayment({ bookingId: 'b-late', status: 'succeeded', operationalStatus: 'late_payment_conflict' }),
    });
    expect(legacy.providerOrderId).toBeUndefined();
    expect(late.status).toBe('succeeded');
    expect(late.operationalStatus).toBe('late_payment_conflict');
  });

  it('persists distinct webhook events, optionally linked to a payment', async () => {
    const payment = await prisma.payment.create({ data: legacyPayment({ providerOrderId: 'order_linked' }) });
    const first = await prisma.paymentWebhookEvent.create({ data: { provider: 'razorpay', providerEventId: 'evt_1', eventType: 'payment.captured', paymentId: payment.id, payloadHash: 'a'.repeat(64) } });
    const second = await prisma.paymentWebhookEvent.create({ data: { provider: 'razorpay', providerEventId: 'evt_2', eventType: 'payment.failed' } });
    expect(first.paymentId).toBe(payment.id);
    expect(second.paymentId).toBeUndefined();
  });

  it('enforces provider plus event ID uniqueness while allowing the same ID for another provider', async () => {
    await prisma.paymentWebhookEvent.create({ data: { provider: 'razorpay', providerEventId: 'evt_same', eventType: 'payment.captured' } });
    await expect(prisma.paymentWebhookEvent.create({ data: { provider: 'razorpay', providerEventId: 'evt_same', eventType: 'payment.captured' } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.paymentWebhookEvent.create({ data: { provider: 'another-provider', providerEventId: 'evt_same', eventType: 'payment.captured' } })).resolves.toMatchObject({ provider: 'another-provider' });
  });
});
