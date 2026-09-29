'use strict';

const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { WalletService } = require('../src/modules/wallet/service');

describe('Wallet internal mutation engine', () => {
  let user;

  beforeEach(async () => {
    resetStore();
    user = await seedUser({
      email: `wallet-mutation-${Math.random()}@test`,
    });
  });

  const base = (overrides = {}) => ({
    userId: user.id,
    amount: '100.00',
    referenceType: 'adjustment',
    referenceId: 'test-reference',
    description: 'Internal wallet engine test',
    idempotencyKey: 'wallet-test-key-0001',
    ...overrides,
  });

  it('credits atomically and creates exactly one ledger row', async () => {
    const result = await WalletService.creditWallet(base());

    expect(result.replayed).toBe(false);
    expect(result.wallet.balance).toBe('100.00');
    expect(result.transaction).toMatchObject({
      type: 'credit',
      amount: '100.00',
      balanceBefore: '0.00',
      balanceAfter: '100.00',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('100.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it('debits an existing wallet without floating point drift', async () => {
    await WalletService.creditWallet(base({
      amount: '0.30',
      idempotencyKey: 'wallet-credit-precision',
    }));

    const result = await WalletService.debitWallet(base({
      amount: '0.10',
      idempotencyKey: 'wallet-debit-precision',
    }));

    expect(result.wallet.balance).toBe('0.20');
    expect(result.transaction.balanceBefore).toBe('0.30');
    expect(result.transaction.balanceAfter).toBe('0.20');
  });

  it('rejects insufficient balance and does not append a debit ledger row', async () => {
    await WalletService.creditWallet(base({
      amount: '50.00',
      idempotencyKey: 'wallet-seed-balance',
    }));

    await expect(
      WalletService.debitWallet(base({
        amount: '50.01',
        idempotencyKey: 'wallet-insufficient',
      })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_INSUFFICIENT_BALANCE',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('50.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it('replays same idempotency key with same request without double credit', async () => {
    const request = base({
      amount: '25.50',
      idempotencyKey: 'wallet-replay-key',
    });

    const first = await WalletService.creditWallet(request);
    const second = await WalletService.creditWallet(request);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('25.50');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it('rejects same idempotency key with a different request', async () => {
    await WalletService.creditWallet(base({
      amount: '10.00',
      idempotencyKey: 'wallet-conflict-key',
    }));

    await expect(
      WalletService.creditWallet(base({
        amount: '11.00',
        idempotencyKey: 'wallet-conflict-key',
      })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_IDEMPOTENCY_CONFLICT',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('10.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(1);
  });

  it.each(['frozen', 'closed'])('blocks mutations when wallet is %s', async (status) => {
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: '20.00',
        currencyCode: 'INR',
        status,
      },
    });

    await expect(
      WalletService.creditWallet(base({
        idempotencyKey: `wallet-${status}-key`,
      })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_NOT_ACTIVE',
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    expect(Number(wallet.balance).toFixed(2)).toBe('20.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(0);
  });

  it('rolls back ledger and balance together when the transaction fails', async () => {
    await expect(
      WalletService.creditWallet(base({
        amount: '75.00',
        idempotencyKey: 'wallet-rollback-key',
        testHooks: {
          afterLedger: async () => {
            throw new Error('forced-wallet-rollback');
          },
        },
      })),
    ).rejects.toThrow('forced-wallet-rollback');

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });

    // Empty wallet creation may remain; money movement must not.
    expect(Number(wallet.balance).toFixed(2)).toBe('0.00');
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id } })).toBe(0);
  });

  it('stores only hashes, never the raw idempotency key', async () => {
    const rawKey = 'super-secret-wallet-idempotency-key';
    const result = await WalletService.creditWallet(base({
      idempotencyKey: rawKey,
    }));

    const stored = await prisma.walletTransaction.findUnique({
      where: { id: result.transaction.id },
    });

    expect(stored.idempotencyKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.idempotencyKeyHash).not.toBe(rawKey);
    expect(JSON.stringify(stored)).not.toContain(rawKey);
  });

  it('rejects invalid precision and zero amounts before money movement', async () => {
    for (const amount of ['0', '0.00', '-1.00', '1.001', 'abc']) {
      await expect(
        WalletService.creditWallet(base({
          amount,
          idempotencyKey: `invalid-${String(amount).replace(/\W/g, '')}-key`,
        })),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'WALLET_AMOUNT_INVALID',
      });
    }

    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('keeps customer wallet read DTO free of mutation hashes', async () => {
    await WalletService.creditWallet(base({
      idempotencyKey: 'wallet-safe-dto-key',
    }));

    const read = await WalletService.getWallet(user.id);
    const ledger = await WalletService.listTransactions(user.id, {
      page: 1,
      limit: 20,
    });

    const serialized = JSON.stringify({ read, ledger });
    expect(serialized).not.toContain('idempotencyKeyHash');
    expect(serialized).not.toContain('requestHash');
    expect(serialized).not.toContain('wallet-safe-dto-key');
  });
});
