'use strict';

jest.mock('../src/modules/payments/providers/razorpay', () => ({
  createOrder: jest.fn(),
  verifyCheckoutSignature: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  parseWebhookEvent: jest.fn(),
  fetchPaymentState: jest.fn(),
}));

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');
const razorpay = require('../src/modules/payments/providers/razorpay');

describe('Wallet Razorpay top-up API', () => {
  let app;
  let user;
  let token;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();
    jest.clearAllMocks();

    user = await seedUser({
      email: `wallet-topup-${Math.random()}@test`,
    });

    token = signAccessToken({
      sub: user.id,
    });

    razorpay.createOrder.mockResolvedValue({
      id: 'order_wallet_100',
      amount: 10000,
      currency: 'INR',
    });

    razorpay.verifyCheckoutSignature.mockReturnValue(true);

    razorpay.fetchPaymentState.mockResolvedValue({
      id: 'pay_wallet_100',
      order_id: 'order_wallet_100',
      amount: 10000,
      currency: 'INR',
      status: 'captured',
    });
  });

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  async function createTopup(amount = '100.00') {
    return request(app).post('/api/v1/wallet/topups').set(auth()).send({
      amount,
    });
  }

  function verificationBody(topupId, overrides = {}) {
    return {
      topupId,
      razorpayOrderId: 'order_wallet_100',
      razorpayPaymentId: 'pay_wallet_100',
      razorpaySignature: 'a'.repeat(64),
      ...overrides,
    };
  }

  it('requires authentication for wallet top-up creation', async () => {
    const response = await request(app).post('/api/v1/wallet/topups').send({
      amount: '100.00',
    });

    expect(response.status).toBe(401);
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it('creates a pending Razorpay order using exact paise', async () => {
    const response = await createTopup('100.00');

    expect(response.status).toBe(201);

    expect(razorpay.createOrder).toHaveBeenCalledTimes(1);

    expect(razorpay.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: 'INR',
      }),
    );

    expect(response.body.data.checkout).toMatchObject({
      orderId: 'order_wallet_100',
      amount: 10000,
      currency: 'INR',
    });

    expect(response.body.data.topup).toMatchObject({
      amount: '100.00',
      currencyCode: 'INR',
      provider: 'razorpay',
      providerOrderId: 'order_wallet_100',
      status: 'pending',
    });

    const topup = await prisma.walletTopup.findFirst({
      where: {
        userId: user.id,
      },
    });

    expect(topup).not.toBeNull();
    expect(Number(topup.amount).toFixed(2)).toBe('100.00');
    expect(topup.status).toBe('pending');

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('rejects invalid top-up amounts before calling Razorpay', async () => {
    for (const amount of ['0', '0.99', '100000.01', '1.001']) {
      const response = await createTopup(amount);

      expect(response.status).toBe(422);
    }

    expect(razorpay.createOrder).not.toHaveBeenCalled();
    expect(await prisma.walletTopup.count()).toBe(0);
  });

  it('rejects an invalid checkout signature without crediting wallet', async () => {
    const created = await createTopup();

    expect(created.status).toBe(201);

    razorpay.verifyCheckoutSignature.mockReturnValue(false);

    const response = await request(app)
      .post('/api/v1/wallet/topups/verify')
      .set(auth())
      .send(verificationBody(created.body.data.topup.id));

    expect(response.status).toBe(400);

    expect(razorpay.fetchPaymentState).not.toHaveBeenCalled();

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);

    const topup = await prisma.walletTopup.findUnique({
      where: {
        id: created.body.data.topup.id,
      },
    });

    expect(topup.status).toBe('pending');
  });

  it('rejects a mismatched Razorpay order without crediting wallet', async () => {
    const created = await createTopup();

    const response = await request(app)
      .post('/api/v1/wallet/topups/verify')
      .set(auth())
      .send(
        verificationBody(created.body.data.topup.id, {
          razorpayOrderId: 'order_wrong',
        }),
      );

    expect(response.status).toBe(400);

    expect(razorpay.verifyCheckoutSignature).not.toHaveBeenCalled();

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('rejects a payment whose provider amount does not match the top-up', async () => {
    const created = await createTopup();

    razorpay.fetchPaymentState.mockResolvedValue({
      id: 'pay_wallet_100',
      order_id: 'order_wallet_100',
      amount: 9999,
      currency: 'INR',
      status: 'captured',
    });

    const response = await request(app)
      .post('/api/v1/wallet/topups/verify')
      .set(auth())
      .send(verificationBody(created.body.data.topup.id));

    expect(response.status).toBe(400);

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('rejects a payment that is not captured', async () => {
    const created = await createTopup();

    razorpay.fetchPaymentState.mockResolvedValue({
      id: 'pay_wallet_100',
      order_id: 'order_wallet_100',
      amount: 10000,
      currency: 'INR',
      status: 'authorized',
    });

    const response = await request(app)
      .post('/api/v1/wallet/topups/verify')
      .set(auth())
      .send(verificationBody(created.body.data.topup.id));

    expect(response.status).toBe(409);

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('credits exactly INR 100 for an INR 100 captured payment', async () => {
    const created = await createTopup('100.00');

    expect(created.status).toBe(201);

    const response = await request(app)
      .post('/api/v1/wallet/topups/verify')
      .set(auth())
      .send(verificationBody(created.body.data.topup.id));

    expect(response.status).toBe(200);

    expect(response.body.data.replayed).toBe(false);

    expect(response.body.data.wallet.balance).toBe('100.00');

    expect(response.body.data.transaction).toMatchObject({
      type: 'credit',
      amount: '100.00',
      balanceBefore: '0.00',
      balanceAfter: '100.00',
      referenceType: 'topup',
      referenceId: created.body.data.topup.id,
    });

    const wallet = await prisma.wallet.findUnique({
      where: {
        userId: user.id,
      },
    });

    expect(wallet).not.toBeNull();

    // Critical contract:
    // INR 100 paid = INR 100 wallet balance.
    // No 3% bonus.
    expect(Number(wallet.balance).toFixed(2)).toBe('100.00');

    const transactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
      },
    });

    expect(transactions).toHaveLength(1);
    expect(Number(transactions[0].amount).toFixed(2)).toBe('100.00');

    const topup = await prisma.walletTopup.findUnique({
      where: {
        id: created.body.data.topup.id,
      },
    });

    expect(topup.status).toBe('paid');
    expect(topup.providerPaymentId).toBe('pay_wallet_100');
    expect(topup.paidAt).not.toBeNull();
  });

  it('replays successful verification without double credit', async () => {
    const created = await createTopup('100.00');

    const body = verificationBody(created.body.data.topup.id);

    const first = await request(app).post('/api/v1/wallet/topups/verify').set(auth()).send(body);

    expect(first.status).toBe(200);
    expect(first.body.data.replayed).toBe(false);

    const second = await request(app).post('/api/v1/wallet/topups/verify').set(auth()).send(body);

    expect(second.status).toBe(200);
    expect(second.body.data.replayed).toBe(true);

    const wallet = await prisma.wallet.findUnique({
      where: {
        userId: user.id,
      },
    });

    expect(Number(wallet.balance).toFixed(2)).toBe('100.00');

    expect(
      await prisma.walletTransaction.count({
        where: {
          walletId: wallet.id,
        },
      }),
    ).toBe(1);
  });

  it('does not allow another user to verify the top-up', async () => {
    const created = await createTopup();

    const other = await seedUser({
      email: `wallet-topup-other-${Math.random()}@test`,
    });

    const otherToken = signAccessToken({
      sub: other.id,
    });

    const response = await request(app)
      .post('/api/v1/wallet/topups/verify')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(verificationBody(created.body.data.topup.id));

    expect(response.status).toBe(404);

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });
});
