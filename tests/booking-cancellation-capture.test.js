'use strict';
jest.mock('../src/modules/payments/providers/razorpay', () => ({ createRefund: jest.fn(), createOrder: jest.fn(), verifyCheckoutSignature: jest.fn(), verifyWebhookSignature: jest.fn(), parseWebhookEvent: jest.fn() }));
const { prisma, resetStore, seedUser } = require('./helpers/auth'); const razorpay = require('../src/modules/payments/providers/razorpay');
async function fixture({ paid = false, status = paid ? 'CONFIRMED' : 'PAYMENT_PENDING', startAt = new Date(Date.now() + 86400000) } = {}) { const user = await seedUser({ email: `cancel-${Math.random()}@test` }); const car = await prisma.car.create({ data: { vendorId: 'v', branchId: 'b', registrationNumber: `C-${Math.random()}`, brand: 'T', model: 'C', manufacturingYear: 2025, status: 'available' } }); const booking = await prisma.booking.create({ data: { bookingNumber: `C-${Math.random()}`, userId: user.id, vendorId: 'v', carId: car.id, startAt, endAt: new Date(startAt.getTime() + 3600000), subtotal: 100, totalAmount: 100, currencyCode: 'INR', status, paymentStatus: paid ? 'succeeded' : 'pending', holdExpiresAt: new Date(Date.now() + 3600000) } }); if (paid) await prisma.payment.create({ data: { bookingId: booking.id, userId: user.id, amount: 100, currencyCode: 'INR', provider: 'razorpay', providerPaymentId: `pay_${booking.id}`, status: 'succeeded' } }); return { user, booking }; }

const { cancelBooking } = require('../src/modules/bookings/service');
const { processWebhook } = require('../src/modules/payments/service');
async function captureFixture() {
  const f = await fixture();
  f.payment = await prisma.payment.create({ data: { bookingId: f.booking.id, userId: f.user.id, amount: 100, currencyCode: 'INR', provider: 'razorpay', providerOrderId: `order_${f.booking.id}`, status: 'pending', operationalStatus: 'normal' } });
  return f;
}
function capture(f) { return processWebhook({ eventId: `evt_${f.payment.id}`, rawBody: Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${f.payment.id}`, order_id: f.payment.providerOrderId, amount: 10000, currency: 'INR' } } } })) }); }
function cancel(f, key = 'durable-cancel-key') { return cancelBooking({ userId: f.user.id, bookingId: f.booking.id, idempotencyKey: key }); }
describe('cancellation/capture winner semantics', () => {
  beforeEach(() => { resetStore(); jest.clearAllMocks(); razorpay.parseWebhookEvent.mockImplementation((raw) => JSON.parse(raw.toString())); razorpay.createRefund.mockResolvedValue({ providerRefundId: 'rfnd_winner', status: 'pending' }); });
  it('keeps cancellation final and records late captured money without refund or confirmation', async () => {
    const f = await captureFixture(); await cancel(f); await capture(f);
    expect(await prisma.booking.findUnique({ where: { id: f.booking.id } })).toMatchObject({ status: 'CANCELLED', paymentStatus: 'pending' });
    expect(await prisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ status: 'succeeded', operationalStatus: 'late_payment_conflict', providerPaymentId: `pay_${f.payment.id}` });
    expect(await prisma.refund.count()).toBe(0); expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.bookingStatusHistory.count({ where: { toStatus: 'CONFIRMED' } })).toBe(0);
    expect(await prisma.bookingStatusHistory.count({ where: { toStatus: 'CANCELLED' } })).toBe(1);
    expect(razorpay.createRefund).not.toHaveBeenCalled();
  });
  it('refunds the full amount once when capture wins, and completed refund replay has no provider call', async () => {
    const f = await captureFixture(); await capture(f);
    razorpay.createRefund.mockResolvedValue({ providerRefundId: 'rfnd_winner', status: 'processed' });
    await cancel(f); await cancel(f); await cancel(f, 'different-caller-key');
    expect(await prisma.booking.findUnique({ where: { id: f.booking.id } })).toMatchObject({ status: 'CANCELLED', paymentStatus: 'refunded' });
    expect(await prisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ status: 'refunded', operationalStatus: 'normal' });
    expect(await prisma.refund.count()).toBe(1);
    expect(await prisma.refund.findFirst({ where: { bookingId: f.booking.id } })).toMatchObject({ amount: 100, status: 'succeeded', idempotencyKey: 'durable-cancel-key' });
    expect(razorpay.createRefund).toHaveBeenCalledTimes(1);
    expect(razorpay.createRefund).toHaveBeenCalledWith({ providerPaymentId: `pay_${f.payment.id}`, amountMinor: 10000, idempotencyKey: 'durable-cancel-key' });
    expect(await prisma.bookingStatusHistory.count({ where: { toStatus: 'CONFIRMED' } })).toBe(1);
    expect(await prisma.bookingStatusHistory.count({ where: { toStatus: 'CANCELLED' } })).toBe(1);
  });
  it('does not issue a provider request when cancellation rolls back after its mutation', async () => {
    const f = await captureFixture(); await capture(f);
    await expect(cancelBooking({ userId: f.user.id, bookingId: f.booking.id, idempotencyKey: 'rollback-key', testHooks: { afterBookingMutation: async () => { throw new Error('rollback cancellation'); } } })).rejects.toThrow('rollback cancellation');
    expect(await prisma.booking.findUnique({ where: { id: f.booking.id } })).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'succeeded' });
    expect(await prisma.refund.count()).toBe(0); expect(razorpay.createRefund).not.toHaveBeenCalled();
    expect(await prisma.bookingStatusHistory.count({ where: { toStatus: 'CANCELLED' } })).toBe(0);
  });
});
