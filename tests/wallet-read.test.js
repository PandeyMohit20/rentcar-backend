'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

describe('Customer wallet read API', () => {
  let app;
  let user;
  let other;
  let token;
  let otherToken;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();

    user = await seedUser({
      email: `wallet-user-${Math.random()}@test`,
    });

    other = await seedUser({
      email: `wallet-other-${Math.random()}@test`,
    });

    token = signAccessToken({
      sub: user.id,
      type: 'access',
    });

    otherToken = signAccessToken({
      sub: other.id,
      type: 'access',
    });
  });

  const auth = (value) => ({
    Authorization: `Bearer ${value}`,
  });

  it('requires authentication for wallet and transaction reads', async () => {
    expect((await request(app).get('/api/v1/wallet')).status).toBe(401);
    expect((await request(app).get('/api/v1/wallet/transactions')).status).toBe(401);
  });

  it('returns a virtual zero wallet without creating a database row', async () => {
    expect(await prisma.wallet.count()).toBe(0);

    const response = await request(app)
      .get('/api/v1/wallet')
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.data.wallet).toEqual({
      id: null,
      balance: '0.00',
      currencyCode: 'INR',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    });

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('returns empty standard pagination without creating a wallet', async () => {
    const response = await request(app)
      .get('/api/v1/wallet/transactions?page=2&limit=10')
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
    });

    expect(await prisma.wallet.count()).toBe(0);
  });

  it('returns only the authenticated user wallet', async () => {
    const mine = await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 1250.5,
        currencyCode: 'INR',
        status: 'active',
      },
    });

    await prisma.wallet.create({
      data: {
        userId: other.id,
        balance: 9999,
        currencyCode: 'INR',
        status: 'active',
      },
    });

    const response = await request(app)
      .get('/api/v1/wallet')
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.data.wallet.id).toBe(mine.id);
    expect(response.body.data.wallet.balance).toBe('1250.50');
    expect(JSON.stringify(response.body)).not.toContain('9999');
  });

  it('lists own transactions newest-first with safe fields and standard pagination', async () => {
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 300,
        currencyCode: 'INR',
        status: 'active',
      },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'credit',
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        referenceType: 'refund',
        referenceId: 'refund-old',
        description: 'Old transaction',
        idempotencyKeyHash: 'a'.repeat(64),
        requestHash: 'b'.repeat(64),
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    });

    const newest = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'credit',
        amount: 200,
        balanceBefore: 100,
        balanceAfter: 300,
        referenceType: 'refund',
        referenceId: 'refund-new',
        description: 'New transaction',
        idempotencyKeyHash: 'c'.repeat(64),
        requestHash: 'd'.repeat(64),
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      },
    });

    const response = await request(app)
      .get('/api/v1/wallet/transactions?page=1&limit=1')
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: newest.id,
      type: 'credit',
      amount: '200.00',
      balanceBefore: '100.00',
      balanceAfter: '300.00',
      referenceType: 'refund',
      referenceId: 'refund-new',
      description: 'New transaction',
    });

    expect(response.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain('idempotencyKeyHash');
    expect(raw).not.toContain('requestHash');
    expect(raw).not.toContain('aaaa');
    expect(raw).not.toContain('bbbb');
  });

  it('does not leak another user transactions', async () => {
    const mine = await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 10,
        currencyCode: 'INR',
        status: 'active',
      },
    });

    const theirs = await prisma.wallet.create({
      data: {
        userId: other.id,
        balance: 777,
        currencyCode: 'INR',
        status: 'active',
      },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: mine.id,
        type: 'credit',
        amount: 10,
        balanceBefore: 0,
        balanceAfter: 10,
        referenceType: 'adjustment',
        referenceId: 'mine',
        description: 'Mine',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: theirs.id,
        type: 'credit',
        amount: 777,
        balanceBefore: 0,
        balanceAfter: 777,
        referenceType: 'adjustment',
        referenceId: 'secret-other',
        description: 'Other user transaction',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    const mineResponse = await request(app)
      .get('/api/v1/wallet/transactions')
      .set(auth(token));

    expect(mineResponse.status).toBe(200);
    expect(mineResponse.body.data.items).toHaveLength(1);
    expect(mineResponse.body.data.items[0].referenceId).toBe('mine');
    expect(JSON.stringify(mineResponse.body)).not.toContain('secret-other');

    const otherResponse = await request(app)
      .get('/api/v1/wallet/transactions')
      .set(auth(otherToken));

    expect(otherResponse.status).toBe(200);
    expect(otherResponse.body.data.items).toHaveLength(1);
    expect(otherResponse.body.data.items[0].referenceId).toBe('secret-other');
  });

  it('ignores attempted userId scoping by rejecting unsupported query keys', async () => {
    await prisma.wallet.create({
      data: {
        userId: other.id,
        balance: 500,
        currencyCode: 'INR',
        status: 'active',
      },
    });

    const response = await request(app)
      .get(`/api/v1/wallet/transactions?userId=${other.id}`)
      .set(auth(token));

    expect(response.status).toBe(422);
  });

  it('validates transaction pagination', async () => {
    for (const query of [
      '?page=0',
      '?page=-1',
      '?limit=0',
      '?limit=101',
      '?page=abc',
      '?limit=abc',
    ]) {
      const response = await request(app)
        .get(`/api/v1/wallet/transactions${query}`)
        .set(auth(token));

      expect(response.status).toBe(422);
    }
  });
});
