'use strict';
const { prisma, resetStore } = require('./helpers/auth');
const paymentService = require('../src/modules/payments/service');
const refundService = require('../src/modules/refunds/service');
const { projectBooking, deliver } = require('../src/services/email/transactional');

async function fixture() {
  const user = await prisma.user.create({
    data: { name: 'Fixture', email: 'lifecycle@example.test' },
  });
  const car = await prisma.car.create({
    data: { brand: 'Fixture', model: 'Car', status: 'available' },
  });
  const booking = await prisma.booking.create({
    data: {
      userId: user.id,
      carId: car.id,
      vendorId: 'fixture',
      bookingNumber: 'EMAIL-WEBHOOK',
      startAt: new Date('2030-01-01'),
      endAt: new Date('2030-01-02'),
      subtotal: 100,
      totalAmount: 100,
      currencyCode: 'INR',
      status: 'PAYMENT_PENDING',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() + 600000),
    },
  });
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId: user.id,
      provider: 'razorpay',
      providerOrderId: 'order_fixture',
      amount: 100,
      currencyCode: 'INR',
      status: 'pending',
    },
  });
  return { booking, payment };
}
const capture = (eventId) =>
  paymentService.processWebhook({
    eventId,
    rawBody: Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_fixture',
              order_id: 'order_fixture',
              amount: 10000,
              currency: 'INR',
            },
          },
        },
      }),
    ),
  });
describe('Committed webhook email projection', () => {
  beforeEach(resetStore);
  it('duplicate captures/refunds produce one logical email each and SMTP failure cannot undo finance', async () => {
    const f = await fixture();
    await capture('capture-1');
    await capture('capture-1');
    let b = await prisma.booking.findUnique({ where: { id: f.booking.id } });
    await projectBooking(b);
    await projectBooking(b);
    expect(await prisma.emailDelivery.count({ where: { eventType: 'booking_confirmed' } })).toBe(1);
    const confirmation = await prisma.emailDelivery.findFirst({
      where: { eventType: 'booking_confirmed' },
    });
    await deliver(confirmation.id, {
      mode: 'smtp',
      allowlist: 'lifecycle@example.test',
      send: async () => {
        throw { responseCode: 450 };
      },
    });
    expect((await prisma.payment.findUnique({ where: { id: f.payment.id } })).status).toBe(
      'succeeded',
    );
    expect((await prisma.booking.findUnique({ where: { id: f.booking.id } })).status).toBe(
      'CONFIRMED',
    );
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
    const refund = await prisma.refund.create({
      data: {
        bookingId: b.id,
        paymentId: f.payment.id,
        providerReference: 'rfnd_fixture',
        amount: 100,
        currencyCode: 'INR',
        status: 'pending',
      },
    });
    const event = {
      eventId: 'refund-1',
      rawBody: Buffer.from(
        JSON.stringify({
          event: 'refund.processed',
          payload: {
            refund: {
              entity: {
                id: 'rfnd_fixture',
                payment_id: 'pay_fixture',
                amount: 10000,
                currency: 'INR',
              },
            },
          },
        }),
      ),
    };
    await refundService.processWebhook(event);
    await refundService.processWebhook(event);
    b = await prisma.booking.findUnique({ where: { id: b.id } });
    await projectBooking(b);
    await projectBooking(b);
    expect(await prisma.emailDelivery.count({ where: { eventType: 'refund_succeeded' } })).toBe(1);
    expect((await prisma.refund.findUnique({ where: { id: refund.id } })).status).toBe('succeeded');
  });
  it('projects payment failure and verified refund failure without success wording', async () => {
    const f = await fixture();
    await paymentService.processWebhook({
      eventId: 'failed-1',
      rawBody: Buffer.from(
        JSON.stringify({
          event: 'payment.failed',
          payload: { payment: { entity: { order_id: 'order_fixture' } } },
        }),
      ),
    });
    await projectBooking(f.booking);
    expect(await prisma.emailDelivery.count({ where: { eventType: 'payment_failed' } })).toBe(1);
    await prisma.payment.update({
      where: { id: f.payment.id },
      data: { status: 'succeeded', providerPaymentId: 'pay_fixture' },
    });
    await prisma.booking.update({
      where: { id: f.booking.id },
      data: { status: 'CANCELLED', paymentStatus: 'succeeded' },
    });
    const refund = await prisma.refund.create({
      data: {
        bookingId: f.booking.id,
        paymentId: f.payment.id,
        providerReference: 'rfnd_fixture',
        amount: 100,
        currencyCode: 'INR',
        status: 'pending',
      },
    });
    await refundService.processWebhook({
      eventId: 'refund-failed-1',
      rawBody: Buffer.from(
        JSON.stringify({
          event: 'refund.failed',
          payload: {
            refund: {
              entity: {
                id: 'rfnd_fixture',
                payment_id: 'pay_fixture',
                amount: 10000,
                currency: 'INR',
              },
            },
          },
        }),
      ),
    });
    await projectBooking(await prisma.booking.findUnique({ where: { id: f.booking.id } }));
    expect(await prisma.emailDelivery.count({ where: { eventType: 'refund_failed' } })).toBe(1);
    expect(await prisma.emailDelivery.count({ where: { eventType: 'refund_succeeded' } })).toBe(0);
    expect((await prisma.refund.findUnique({ where: { id: refund.id } })).status).toBe('failed');
  });
});
