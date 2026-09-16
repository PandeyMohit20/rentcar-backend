'use strict';
jest.mock('../src/modules/payments/providers/razorpay', () => ({
  fetchOrderState: jest.fn(),
  fetchPaymentState: jest.fn(),
  parseWebhookEvent: (raw) => JSON.parse(raw),
}));
const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');
const provider = require('../src/modules/payments/providers/razorpay');
const { reconcile } = require('../src/modules/payments/reconciliation');
const { processWebhook } = require('../src/modules/payments/service');
const app = createApp();
let user, booking, payment, entity, remote, token;
beforeEach(async () => {
  resetStore();
  jest.clearAllMocks();
  user = await seedUser({ email: 'reconciliation-isolated@example.test' });
  token = signAccessToken({ sub: user.id });
  const car = await prisma.car.create({ data: { status: 'available' } });
  booking = await prisma.booking.create({
    data: {
      userId: user.id,
      carId: car.id,
      vendorId: 'test',
      bookingNumber: 'RECON-LOCAL',
      startAt: new Date('2030-01-01'),
      endAt: new Date('2030-01-02'),
      subtotal: 100,
      totalAmount: 123.45,
      currencyCode: 'INR',
      status: 'PAYMENT_PENDING',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() - 1000),
    },
  });
  payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId: user.id,
      provider: 'razorpay',
      providerOrderId: 'order_reconcile',
      amount: 123.45,
      currencyCode: 'INR',
      status: 'pending',
      operationalStatus: 'normal',
    },
  });
  entity = {
    id: 'pay_reconcile',
    order_id: payment.providerOrderId,
    status: 'captured',
    amount: 12345,
    currency: 'INR',
  };
  remote = {
    order: { id: payment.providerOrderId, amount: 12345, currency: 'INR' },
    payments: [entity],
    complete: true,
  };
  provider.fetchOrderState.mockImplementation(async () => remote);
  provider.fetchPaymentState.mockImplementation(async () => entity);
});
afterEach(() => jest.restoreAllMocks());
const recover = () => reconcile({ userId: user.id, bookingId: booking.id });
const post = (body = {}, auth = token) => {
  const r = request(app).post(`/api/v1/payments/${booking.id}/reconcile`);
  if (auth) r.set('Authorization', `Bearer ${auth}`);
  return r.send(body);
};
const webhook = (id = 'evt_reconcile') =>
  processWebhook({
    eventId: id,
    rawBody: Buffer.from(
      JSON.stringify({ event: 'payment.captured', payload: { payment: { entity } } }),
    ),
  });
async function singleSettlement() {
  expect(await prisma.payment.count()).toBe(1);
  expect(await prisma.booking.count()).toBe(1);
  expect(await prisma.invoice.count()).toBe(1);
  expect(await prisma.bookingStatusHistory.count()).toBe(1);
  expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe('CONFIRMED');
  expect(await prisma.payment.findUnique({ where: { id: payment.id } })).toMatchObject({
    providerPaymentId: entity.id,
    status: 'succeeded',
    amount: 123.45,
  });
  const { projectBooking } = require('../src/services/email/transactional');
  const committed = await prisma.booking.findUnique({ where: { id: booking.id } });
  await projectBooking(committed);
  await projectBooking(committed);
  expect(
    await prisma.emailDelivery.count({
      where: {
        bookingId: booking.id,
        eventType: 'booking_confirmed',
      },
    }),
  ).toBe(1);
}
it('captured payment recovers expired hold with exact paise and safe audit', async () => {
  expect((await post()).status).toBe(200);
  await singleSettlement();
  const a = await prisma.auditLog.findFirst();
  expect(a.result).toBe('reconciled');
  expect(JSON.parse(a.metadata)).toMatchObject({
    source: 'provider_reconciliation',
    previousStatus: 'pending',
    resultingStatus: 'succeeded',
    providerPaymentId: entity.id,
  });
});
it.each([
  { amount: 12344 },
  { amount: 12345.1 },
  { currency: 'USD' },
  { order_id: 'order_other' },
  { id: 'pay_other' },
])('rejects fetched payment mismatch %j without financial mutation', async (changes) => {
  provider.fetchPaymentState.mockResolvedValue({ ...entity, ...changes });
  await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
  expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('pending');
  expect(await prisma.invoice.count()).toBe(0);
  expect(await prisma.auditLog.count()).toBe(1);
});
it.each([{ id: 'order_other' }, { amount: 1 }, { currency: 'USD' }])(
  'rejects mismatched provider order %j',
  async (changes) => {
    remote.order = { ...remote.order, ...changes };
    await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.fetchPaymentState).not.toHaveBeenCalled();
  },
);
it('rejects provider payment linked to another booking', async () => {
  await prisma.payment.create({
    data: { bookingId: 'other', providerPaymentId: entity.id, status: 'succeeded' },
  });
  await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
  expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('pending');
  expect(await prisma.invoice.count()).toBe(0);
});
it.each(['created', 'pending', 'authorized', 'failed'])(
  'does not confirm provider state %s',
  async (state) => {
    entity.status = state;
    const r = await recover();
    expect(r.paymentStatus).toBe(
      state === 'failed' ? 'failed' : state === 'authorized' ? 'processing' : 'pending',
    );
    expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe(
      'PAYMENT_PENDING',
    );
    expect(await prisma.invoice.count()).toBe(0);
  },
);
it('requires auth and booking ownership before provider fetch', async () => {
  expect((await post({}, null)).status).toBe(401);
  const other = await seedUser({ email: 'other-reconcile@example.test' });
  expect((await post({}, signAccessToken({ sub: other.id }))).status).toBe(404);
  expect(provider.fetchOrderState).not.toHaveBeenCalled();
});
it.each([
  { amount: 1 },
  { captured: true },
  { paymentId: 'pay_untrusted' },
  { orderId: 'order_untrusted' },
])('strictly rejects browser financial assertions %j', async (body) => {
  expect((await post(body)).status).toBe(422);
  expect(provider.fetchOrderState).not.toHaveBeenCalled();
});
it('repeated reconciliation is idempotent', async () => {
  await recover();
  expect((await recover()).outcome).toBe('already_settled');
  expect(provider.fetchOrderState).toHaveBeenCalledTimes(1);
  await singleSettlement();
});
it('webhook then reconciliation is idempotent', async () => {
  await webhook();
  await recover();
  await singleSettlement();
});
it('reconciliation then webhook and duplicate webhook are idempotent', async () => {
  await recover();
  await webhook();
  await webhook();
  await singleSettlement();
});
it('webhook during an in-flight provider fetch settles exactly once', async () => {
  let release;
  provider.fetchOrderState.mockImplementation(
    () =>
      new Promise((r) => {
        release = () => r(remote);
      }),
  );
  const running = recover();
  for (let i = 0; !release && i < 30; i++) await new Promise((r) => setImmediate(r));
  expect(release).toBeDefined();
  await webhook();
  release();
  await running;
  await singleSettlement();
});
it('simultaneous finalization converges using database transaction serialization', async () => {
  // The test store has no SQL locks; serialize transactions to model the car row lock.
  // Production uses SELECT FOR UPDATE, never this JavaScript queue.
  const transaction = prisma.$transaction.bind(prisma);
  let tail = Promise.resolve();
  jest.spyOn(prisma, '$transaction').mockImplementation((fn) => {
    const run = tail.then(() => transaction(fn));
    tail = run.catch(() => {});
    return run;
  });
  await Promise.all([recover(), webhook()]);
  await singleSettlement();
});
it('database cooldown prevents repeated provider calls', async () => {
  entity.status = 'created';
  await recover();
  const r = await post();
  expect(r.status).toBe(429);
  expect(r.headers['retry-after']).toBe('30');
  expect(provider.fetchOrderState).toHaveBeenCalledTimes(1);
});
it('provider failure is safe and audited without state mutation', async () => {
  provider.fetchOrderState.mockRejectedValue(Error('private provider content'));
  const r = await post();
  expect(r.status).toBe(503);
  expect(JSON.stringify(r.body)).not.toContain('private provider content');
  expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('pending');
});
it('permits one captured attempt with historical incomplete attempts', async () => {
  remote.payments.push({ ...entity, id: 'pay_incomplete', status: 'created' });
  await recover();
  await singleSettlement();
});
it.each(['multiple_captures', 'multiple_pending', 'incomplete', 'multiple_local_orders'])(
  'rejects ambiguity: %s',
  async (kind) => {
    if (kind === 'multiple_local_orders')
      await prisma.payment.create({
        data: { bookingId: booking.id, provider: 'razorpay', providerOrderId: 'order_other' },
      });
    else if (kind === 'incomplete') remote.complete = false;
    else {
      remote.payments.push({ ...entity, id: 'pay_second' });
      if (kind === 'multiple_pending')
        remote.payments.forEach((p) => {
          p.status = 'created';
        });
    }
    await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.invoice.count()).toBe(0);
  },
);
it('cancelled booking stays cancelled and captured money is flagged for review', async () => {
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  expect((await recover()).outcome).toBe('review_required');
  expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe('CANCELLED');
  expect(await prisma.invoice.count()).toBe(0);
});
it('transaction failure cannot leave payment settled without booking/document', async () => {
  jest.spyOn(prisma.invoice, 'create').mockRejectedValueOnce(Error('database fault'));
  await expect(recover()).rejects.toMatchObject({ statusCode: 503 });
  expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('pending');
  expect(await prisma.bookingStatusHistory.count()).toBe(0);
});
it('rejects stored booking amount drift', async () => {
  await prisma.booking.update({ where: { id: booking.id }, data: { totalAmount: 124 } });
  await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
  expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('pending');
});
it('does not resolve an authorized competing provider attempt blindly', async () => {
  remote.payments.push({ ...entity, id: 'pay_competing', status: 'authorized' });
  await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
});
it('does not overwrite a concurrent review flag', async () => {
  provider.fetchPaymentState.mockImplementation(async () => {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { operationalStatus: 'review_required' },
    });
    return entity;
  });
  await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
  expect(await prisma.invoice.count()).toBe(0);
});
it.each([
  ['production', 'true', 'rzp_test_isolated'],
  ['development', 'false', 'rzp_test_isolated'],
  ['development', 'true', 'rzp_live_isolated'],
])('UAT recovery fails closed for environment %s flag %s key mode', async (mode, flag, key) => {
  const { env } = require('../src/config/env');
  const previous = { ...env };
  try {
    Object.assign(env, { NODE_ENV: mode, BYPASS_TAX_APPROVAL_FOR_UAT: flag, RAZORPAY_KEY_ID: key });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { financialSnapshot: { taxMode: 'UAT_BYPASS' } },
    });
    await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.fetchOrderState).not.toHaveBeenCalled();
  } finally {
    Object.assign(env, previous);
  }
});

it('recovers the unique capture after a legitimate failed-order retry', async () => {
  const earlier = await prisma.payment.create({
    data: { ...payment, id: 'earlier-local', providerOrderId: 'order_earlier', status: 'failed' },
  });
  provider.fetchOrderState.mockImplementation(async (id) =>
    id === earlier.providerOrderId
      ? {
          order: { id, amount: 12345, currency: 'INR' },
          payments: [{ ...entity, id: 'pay_failed', order_id: id, status: 'failed' }],
          complete: true,
        }
      : remote,
  );
  provider.fetchPaymentState.mockImplementation(async (id) =>
    id === 'pay_failed'
      ? { ...entity, id, order_id: earlier.providerOrderId, status: 'failed' }
      : entity,
  );
  expect((await recover()).outcome).toBe('reconciled');
  expect(await prisma.invoice.count()).toBe(1);
});

it.each(['failed', 'created', 'pending'])(
  'multiple orders: %s earlier attempt plus capture',
  async (status) => {
    const earlier = await prisma.payment.create({
      data: { ...payment, id: 'earlier', providerOrderId: 'order_earlier', status: 'pending' },
    });
    const oldEntity = { ...entity, id: 'pay_earlier', order_id: earlier.providerOrderId, status };
    provider.fetchOrderState.mockImplementation(async (id) =>
      id === earlier.providerOrderId
        ? { order: { ...remote.order, id }, payments: [oldEntity], complete: true }
        : remote,
    );
    provider.fetchPaymentState.mockImplementation(async (id) =>
      id === oldEntity.id ? oldEntity : entity,
    );
    expect((await recover()).outcome).toBe('reconciled');
    await prisma.auditLog.updateMany({ where: {}, data: { createdAt: new Date(0) } });
    expect((await recover()).outcome).toBe('already_settled');
    expect(await prisma.invoice.count()).toBe(1);
    expect(await prisma.bookingStatusHistory.count()).toBe(1);
    const { projectBooking } = require('../src/services/email/transactional');
    const b = await prisma.booking.findUnique({ where: { id: booking.id } });
    await projectBooking(b);
    await projectBooking(b);
    expect(await prisma.emailDelivery.count({ where: { eventType: 'booking_confirmed' } })).toBe(1);
  },
);
it('multiple orders: two genuine distinct captures are audited for review without settlement', async () => {
  const other = await prisma.payment.create({
    data: { ...payment, id: 'other', providerOrderId: 'order_other' },
  });
  const otherEntity = { ...entity, id: 'pay_other', order_id: other.providerOrderId };
  provider.fetchOrderState.mockImplementation(async (id) =>
    id === other.providerOrderId
      ? { order: { ...remote.order, id }, payments: [otherEntity], complete: true }
      : remote,
  );
  provider.fetchPaymentState.mockImplementation(async (id) =>
    id === otherEntity.id ? otherEntity : entity,
  );
  await expect(recover()).rejects.toMatchObject({
    code: 'MULTIPLE_CAPTURED_PAYMENTS_REQUIRES_REVIEW',
  });
  expect(await prisma.invoice.count()).toBe(0);
  expect((await prisma.auditLog.findFirst()).result).toBe('requires_review');
  expect(JSON.parse((await prisma.auditLog.findFirst()).metadata).capturedPaymentIds).toHaveLength(
    2,
  );
});
it.each([{ amount: 999 }, { currency: 'USD' }, { order_id: 'order_wrong' }])(
  'multi-order mismatch rejects %j',
  async (changes) => {
    const other = await prisma.payment.create({
      data: { ...payment, id: 'other', providerOrderId: 'order_other' },
    });
    provider.fetchOrderState.mockImplementation(async (id) =>
      id === other.providerOrderId
        ? { order: { ...remote.order, id }, payments: [], complete: true }
        : remote,
    );
    provider.fetchPaymentState.mockResolvedValue({ ...entity, ...changes });
    await expect(recover()).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.invoice.count()).toBe(0);
  },
);
it('multiple orders with no capture stay pending', async () => {
  await prisma.payment.create({
    data: { ...payment, id: 'other', providerOrderId: 'order_other' },
  });
  provider.fetchOrderState.mockImplementation(async (id) => ({
    order: { ...remote.order, id },
    payments: [],
    complete: true,
  }));
  expect((await recover()).outcome).toBe('pending');
  expect(await prisma.invoice.count()).toBe(0);
});
