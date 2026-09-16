'use strict';
const { prisma, resetStore } = require('./helpers/auth');
const { invoiceData } = require('./helpers/phase7');
const {
  template,
  enqueue,
  projectBooking,
  deliver,
  tick,
} = require('../src/services/email/transactional');
const data = {
  name: '<Customer>',
  bookingNumber: 'BK-EMAIL',
  vehicle: 'Fixture Car',
  pickup: '2027-01-10T00:00:00Z',
  return: '2027-01-11T00:00:00Z',
  total: 618,
  currency: 'INR',
  refundAmount: 618,
};
const recipient = 'designated@example.test';
const opts = (send) => ({ db: prisma, send, mode: 'smtp', allowlist: recipient });
async function pending(type = 'booking_created', payload = data) {
  return enqueue(prisma, type, 'entity-1', { id: 'booking-1' }, payload, recipient);
}
describe('Durable transactional delivery', () => {
  beforeEach(resetStore);
  it('worker start boundary preserves old backlog and resumes a durable queued notification once', async () => {
    const old = await pending();
    await prisma.emailDelivery.update({
      where: { id: old.id },
      data: { createdAt: new Date('2025-01-01') },
    });
    const queued = await enqueue(
      prisma,
      'booking_confirmed',
      'restart-booking',
      { id: 'restart-booking' },
      data,
      recipient,
    );
    const send = jest.fn(async () => ({
      accepted: [recipient],
      messageId: 'accepted-after-restart',
    }));
    // tick has no process-local delivery memory: a subsequent worker invocation
    // resumes persisted pending rows and accepted rows are never resent.
    await tick({ ...opts(send), since: '2026-01-01' });
    await tick({ ...opts(send), since: '2026-01-01' });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await prisma.emailDelivery.findUnique({ where: { id: queued.id } })).status).toBe(
      'accepted',
    );
    expect((await prisma.emailDelivery.findUnique({ where: { id: old.id } })).status).toBe(
      'pending',
    );
  });
  it.each([
    'booking_created',
    'payment_failed',
    'booking_confirmed',
    'invoice_issued',
    'booking_cancelled',
    'refund_succeeded',
    'refund_failed',
  ])('renders %s with escaped HTML and plain text', (type) => {
    const m = template(type, data);
    expect(m.subject).toContain(data.bookingNumber);
    expect(m.text).toContain('INR 618.00');
    expect(m.html).toContain('&lt;Customer&gt;');
    expect(m.html).not.toContain('<Customer>');
  });
  it('uses initiated wording until a refund actually succeeds', () => {
    expect(template('booking_cancelled', data).text).toContain('refund was initiated');
    expect(template('refund_failed', data).text).toContain('could not be processed');
    expect(template('refund_succeeded', data).text).toContain('has been processed');
  });
  it('renders trusted UAT amounts, location and statuses without artificial tax lines', () => {
    const message = template('booking_confirmed', {
      ...data,
      branch: 'Approved pickup branch',
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'succeeded',
      paymentReference: 'pay_authoritative',
      financial: {
        taxMode: 'UAT_BYPASS',
        rentalSubtotal: 100,
        additionalCharges: 18,
        securityDeposit: 500,
        tax: { totalTax: 0 },
      },
    });
    expect(message.html).toContain('CaronRent');
    for (const text of [
      'Approved pickup branch',
      'CONFIRMED',
      'succeeded',
      'pay_authoritative',
      'Rental: INR 100.00',
      'Additional charges: INR 18.00',
      'Security deposit: INR 500.00',
    ])
      expect(message.text).toContain(text);
    expect(message.text).not.toMatch(/GST|CESS|Tax:/i);
  });
  it('does not project confirmation for pending or failed payments', async () => {
    const user = await prisma.user.create({ data: { name: 'Customer', email: recipient } });
    const b = await prisma.booking.create({
      data: {
        userId: user.id,
        carId: 'car',
        bookingNumber: data.bookingNumber,
        startAt: new Date(data.pickup),
        endAt: new Date(data.return),
        status: 'PAYMENT_PENDING',
        paymentStatus: 'pending',
        totalAmount: 618,
        currencyCode: 'INR',
      },
    });
    await prisma.payment.create({ data: { bookingId: b.id, status: 'pending' } });
    await prisma.payment.create({
      data: { bookingId: b.id, status: 'failed', failedAt: new Date() },
    });
    await projectBooking(b);
    expect(await prisma.emailDelivery.count({ where: { eventType: 'booking_confirmed' } })).toBe(0);
  });
  it('dedupes concurrent projection and accepts once after provider acceptance', async () => {
    await Promise.all([pending(), pending()]);
    expect(await prisma.emailDelivery.count()).toBe(1);
    const row = await prisma.emailDelivery.findFirst();
    const send = jest.fn(async () => ({ accepted: [recipient], messageId: 'provider-test-id' }));
    await Promise.all([deliver(row.id, opts(send)), deliver(row.id, opts(send))]);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await prisma.emailDelivery.findUnique({ where: { id: row.id } })).status).toBe(
      'accepted',
    );
  });
  it('blocks nonallowlisted recipients in development/test', async () => {
    const row = await pending();
    const send = jest.fn();
    await deliver(row.id, { ...opts(send), allowlist: '' });
    expect(send).not.toHaveBeenCalled();
    expect((await prisma.emailDelivery.findUnique({ where: { id: row.id } })).lastErrorCode).toBe(
      'TEST_RECIPIENT_NOT_ALLOWLISTED',
    );
  });
  it('retries a definitive rejection safely and never marks it accepted early', async () => {
    const row = await pending();
    const send = jest
      .fn()
      .mockRejectedValueOnce({ responseCode: 450 })
      .mockResolvedValue({ accepted: [recipient] });
    await deliver(row.id, opts(send));
    const failed = await prisma.emailDelivery.findUnique({ where: { id: row.id } });
    expect(failed.status).toBe('failed');
    expect(failed.acceptedAt).toBeFalsy();
    await prisma.emailDelivery.update({
      where: { id: row.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await deliver(row.id, opts(send));
    expect(send).toHaveBeenCalledTimes(2);
    expect((await prisma.emailDelivery.findUnique({ where: { id: row.id } })).status).toBe(
      'accepted',
    );
  });
  it('quarantines ambiguous timeouts and interrupted sends', async () => {
    const row = await pending();
    const send = jest.fn().mockRejectedValue(new Error('Timeout'));
    await deliver(row.id, opts(send));
    await deliver(row.id, opts(send));
    expect(send).toHaveBeenCalledTimes(1);
    expect((await prisma.emailDelivery.findUnique({ where: { id: row.id } })).status).toBe(
      'unknown',
    );
    const other = await enqueue(
      prisma,
      'payment_failed',
      'other',
      { id: 'booking-2' },
      data,
      recipient,
    );
    await prisma.emailDelivery.update({
      where: { id: other.id },
      data: { status: 'sending', claimedAt: new Date(0) },
    });
    await tick({ db: prisma, since: '2026-01-01', mode: 'disabled' });
    expect((await prisma.emailDelivery.findUnique({ where: { id: other.id } })).status).toBe(
      'unknown',
    );
  });
  it('attaches an authoritative invoice to the consolidated confirmation', async () => {
    const invoice = await prisma.invoice.create({ data: invoiceData() });
    const row = await pending('booking_confirmed', { ...data, invoiceId: invoice.id });
    const send = jest.fn(async () => ({ accepted: [recipient] }));
    await deliver(row.id, opts(send));
    const attachment = send.mock.calls[0][0].attachments[0];
    expect(attachment.content.subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('projects committed capture/cancellation and only verified refund outcomes without duplicates', async () => {
    const user = await prisma.user.create({ data: { name: 'Customer', email: recipient } });
    const car = await prisma.car.create({ data: { brand: 'Fixture', model: 'Car' } });
    const b = await prisma.booking.create({
      data: {
        userId: user.id,
        carId: car.id,
        bookingNumber: data.bookingNumber,
        startAt: new Date(data.pickup),
        endAt: new Date(data.return),
        totalAmount: 618,
        currencyCode: 'INR',
        status: 'CANCELLED',
        paymentStatus: 'refunded',
      },
    });
    await prisma.bookingStatusHistory.create({ data: { bookingId: b.id, toStatus: 'CONFIRMED' } });
    const payment = await prisma.payment.create({
      data: { bookingId: b.id, status: 'refunded', paidAt: new Date() },
    });
    const refund = await prisma.refund.create({
      data: { bookingId: b.id, paymentId: payment.id, status: 'succeeded', amount: 618 },
    });
    await projectBooking(b);
    expect(await prisma.emailDelivery.count()).toBe(3);
    await prisma.refundWebhookEvent.create({
      data: { refundId: refund.id, eventType: 'refund.processed', processedAt: new Date() },
    });
    await projectBooking(b);
    await projectBooking(b);
    expect(await prisma.emailDelivery.count()).toBe(4);
    const send = jest.fn().mockRejectedValue({ responseCode: 450 });
    for (const row of await prisma.emailDelivery.findMany()) await deliver(row.id, opts(send));
    expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe(
      'refunded',
    );
    expect((await prisma.refund.findUnique({ where: { id: refund.id } })).status).toBe('succeeded');
    expect((await prisma.booking.findUnique({ where: { id: b.id } })).status).toBe('CANCELLED');
  });
  it('projects an API-verified processed refund even when its webhook was missed', async () => {
    const user = await prisma.user.create({ data: { name: 'Customer', email: recipient } });
    const b = await prisma.booking.create({
      data: {
        userId: user.id,
        carId: 'car',
        bookingNumber: data.bookingNumber,
        startAt: new Date(data.pickup),
        endAt: new Date(data.return),
        status: 'CANCELLED',
        paymentStatus: 'refunded',
        totalAmount: 618,
        currencyCode: 'INR',
      },
    });
    await prisma.refund.create({
      data: {
        bookingId: b.id,
        status: 'succeeded',
        processedAt: new Date(),
        amount: 618,
        providerReference: 'rfnd_verified',
      },
    });
    await projectBooking(b);
    await projectBooking(b);
    const rows = await prisma.emailDelivery.findMany({ where: { eventType: 'refund_succeeded' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({
      refundStatus: 'succeeded',
      refundReference: 'rfnd_verified',
      refundAmount: 618,
    });
  });
});
