'use strict';

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const { parsePagination, buildMeta, computeTotalPages } = require('../../utils/pagination');
const repository = require('./repository');
const { DEFAULT_CURRENCY, DEFAULT_STATUS } = require('./constants');

const IDEMPOTENCY_KEY_MIN = 8;
const IDEMPOTENCY_KEY_MAX = 255;
const REFERENCE_TYPES = new Set([
  'booking',
  'refund',
  'topup',
  'payout',
  'adjustment',
  'commission',
  'cancellation',
]);

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function conflict(message, code = 'CONFLICT') {
  return new AppError(message, 409, code);
}

function badRequest(message, code = 'BAD_REQUEST') {
  return new AppError(message, 400, code);
}

function money(value) {
  if (value === null || value === undefined) return '0.00';

  if (typeof value === 'object' && typeof value.toFixed === 'function') {
    return value.toFixed(2);
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
}

/**
 * Financial mutation parsing intentionally does NOT use floating point maths.
 * Accepted canonical inputs:
 *   "10", "10.5", "10.50"
 * Numeric input is accepted only when finite, positive and has <= 2 decimals.
 * Internally all arithmetic is integer paise (BigInt).
 */
function amountToPaise(value) {
  let raw;

  if (typeof value === 'string') {
    raw = value.trim();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    raw = String(value);
  } else {
    throw badRequest('Wallet amount must be a valid positive amount.', 'WALLET_AMOUNT_INVALID');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw badRequest(
      'Wallet amount must be positive and have at most 2 decimal places.',
      'WALLET_AMOUNT_INVALID',
    );
  }

  const [major, fraction = ''] = raw.split('.');
  const paise = (BigInt(major) * 100n) + BigInt((fraction + '00').slice(0, 2));

  if (paise <= 0n) {
    throw badRequest('Wallet amount must be greater than zero.', 'WALLET_AMOUNT_INVALID');
  }

  // Decimal(14,2) maximum is 999999999999.99.
  if (paise > 99999999999999n) {
    throw badRequest('Wallet amount exceeds the supported limit.', 'WALLET_AMOUNT_INVALID');
  }

  return paise;
}

function decimalToPaise(value) {
  const raw = value && typeof value.toFixed === 'function'
    ? value.toFixed(2)
    : String(value ?? '0');

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new AppError('Stored wallet balance is invalid.', 500, 'WALLET_BALANCE_INVALID');
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [major, fraction = ''] = unsigned.split('.');
  const paise = (BigInt(major) * 100n) + BigInt((fraction + '00').slice(0, 2));
  return negative ? -paise : paise;
}

function paiseToMoney(paise) {
  const negative = paise < 0n;
  const absolute = negative ? -paise : paise;
  const major = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${major}.${fraction}`;
}

function walletDto(wallet) {
  if (!wallet) {
    return {
      id: null,
      balance: '0.00',
      currencyCode: DEFAULT_CURRENCY,
      status: DEFAULT_STATUS,
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    id: wallet.id,
    balance: money(wallet.balance),
    currencyCode: wallet.currencyCode,
    status: wallet.status,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

function transactionDto(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: money(transaction.amount),
    balanceBefore: money(transaction.balanceBefore),
    balanceAfter: money(transaction.balanceAfter),
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId || null,
    description: transaction.description || null,
    createdAt: transaction.createdAt,
  };
}

async function getWallet(userId) {
  const wallet = await repository.findByUserId(userId);
  return walletDto(wallet);
}

async function listTransactions(userId, query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const wallet = await repository.findByUserId(userId);

  if (!wallet) {
    return {
      items: [],
      meta: buildMeta({
        page,
        limit,
        total: 0,
        totalPages: 0,
      }),
    };
  }

  const result = await repository.listTransactions(wallet.id, {
    skip: offset,
    take: limit,
  });

  return {
    items: result.transactions.map(transactionDto),
    meta: buildMeta({
      page,
      limit,
      total: result.total,
      totalPages: computeTotalPages(result.total, limit),
    }),
  };
}

function validateMutationInput(input, type) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Wallet mutation input is required.', 'WALLET_MUTATION_INVALID');
  }

  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  if (!userId) {
    throw badRequest('Wallet user is required.', 'WALLET_USER_REQUIRED');
  }

  const rawKey = typeof input.idempotencyKey === 'string'
    ? input.idempotencyKey.trim()
    : '';

  if (
    rawKey.length < IDEMPOTENCY_KEY_MIN ||
    rawKey.length > IDEMPOTENCY_KEY_MAX
  ) {
    throw badRequest(
      `Idempotency key must be ${IDEMPOTENCY_KEY_MIN}-${IDEMPOTENCY_KEY_MAX} characters.`,
      'WALLET_IDEMPOTENCY_KEY_INVALID',
    );
  }

  if (!REFERENCE_TYPES.has(input.referenceType)) {
    throw badRequest('Wallet reference type is invalid.', 'WALLET_REFERENCE_TYPE_INVALID');
  }

  const amountPaise = amountToPaise(input.amount);
  const amount = paiseToMoney(amountPaise);
  const referenceId = input.referenceId === null || input.referenceId === undefined ? null : String(input.referenceId).trim();
  const description = input.description === null || input.description === undefined ? null : String(input.description).trim();

  if (referenceId && referenceId.length > 36) {
    throw badRequest('Wallet reference id is too long.', 'WALLET_REFERENCE_ID_INVALID');
  }

  if (description && description.length > 500) {
    throw badRequest('Wallet description is too long.', 'WALLET_DESCRIPTION_INVALID');
  }

  const idempotencyKeyHash = digest(rawKey);

  // Versioned tuple makes replay semantics explicit and stable.
  const requestHash = digest(JSON.stringify([
    'wallet-mutation-v1',
    userId,
    type,
    amount,
    DEFAULT_CURRENCY,
    input.referenceType,
    referenceId,
    description,
  ]));

  return {
    userId,
    type,
    amount,
    amountPaise,
    referenceType: input.referenceType,
    referenceId,
    description,
    idempotencyKeyHash,
    requestHash,
  };
}

async function findReplay(db, walletId, idempotencyKeyHash) {
  return db.walletTransaction.findFirst({
    where: {
      walletId,
      idempotencyKeyHash,
    },
  });
}

function replayResult(existing, requestHash) {
  if (existing.requestHash !== requestHash) {
    throw conflict(
      'Idempotency key was already used for a different wallet request.',
      'WALLET_IDEMPOTENCY_CONFLICT',
    );
  }

  return {
    transaction: transactionDto(existing),
    wallet: {
      id: existing.walletId,
      balance: money(existing.balanceAfter),
      currencyCode: DEFAULT_CURRENCY,
    },
    replayed: true,
  };
}

async function ensureWallet(userId) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.wallet.create({
      data: {
        userId,
        balance: '0.00',
        currencyCode: DEFAULT_CURRENCY,
        status: DEFAULT_STATUS,
      },
    });
  } catch (error) {
    // Concurrent first-credit may race on Wallet.userId UNIQUE.
    if (error?.code === 'P2002') {
      const raced = await prisma.wallet.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw error;
  }
}

async function lockWallet(tx, walletId) {
  if (typeof tx.$queryRaw === 'function') {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM wallets WHERE id = ${walletId} FOR UPDATE`,
    );
  }
}

function assertMutable(wallet) {
  if (!wallet) {
    throw conflict('Wallet no longer exists.', 'WALLET_NOT_FOUND');
  }

  if (wallet.status !== 'active') {
    throw conflict(
      `Wallet is ${wallet.status} and cannot be changed.`,
      'WALLET_NOT_ACTIVE',
    );
  }

  if (wallet.currencyCode !== DEFAULT_CURRENCY) {
    throw conflict('Wallet currency is not supported.', 'WALLET_CURRENCY_MISMATCH');
  }
}

async function mutateWallet(type, input) {
  const request = validateMutationInput(input, type);

  // Creation is deliberately outside the balance-changing transaction.
  // It creates only an empty ₹0 wallet and handles the userId unique race.
  // All money movement remains inside the locked transaction below.
  const candidate = await ensureWallet(request.userId);

  const preExisting = await findReplay(
    prisma,
    candidate.id,
    request.idempotencyKeyHash,
  );
  if (preExisting) return replayResult(preExisting, request.requestHash);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockWallet(tx, candidate.id);

      const wallet = await tx.wallet.findUnique({
        where: { id: candidate.id },
      });
      assertMutable(wallet);

      // Re-check after acquiring the wallet row lock.
      const raced = await findReplay(
        tx,
        wallet.id,
        request.idempotencyKeyHash,
      );
      if (raced) return replayResult(raced, request.requestHash);

      const beforePaise = decimalToPaise(wallet.balance);
      const afterPaise = type === 'credit'
        ? beforePaise + request.amountPaise
        : beforePaise - request.amountPaise;

      if (afterPaise < 0n) {
        throw conflict(
          'Insufficient wallet balance.',
          'WALLET_INSUFFICIENT_BALANCE',
        );
      }

      if (afterPaise > 99999999999999n) {
        throw conflict(
          'Wallet balance exceeds the supported limit.',
          'WALLET_BALANCE_LIMIT_EXCEEDED',
        );
      }

      const balanceBefore = paiseToMoney(beforePaise);
      const balanceAfter = paiseToMoney(afterPaise);

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount: request.amount,
          balanceBefore,
          balanceAfter,
          referenceType: request.referenceType,
          referenceId: request.referenceId,
          description: request.description,
          idempotencyKeyHash: request.idempotencyKeyHash,
          requestHash: request.requestHash,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      if (input.testHooks?.afterLedger) {
        await input.testHooks.afterLedger({
          tx,
          wallet: updatedWallet,
          transaction,
        });
      }

      return {
        transaction: transactionDto(transaction),
        wallet: walletDto(updatedWallet),
        replayed: false,
      };
    });
  } catch (error) {
    // Unique index is the final race guard. If another request won,
    // read the winner and apply normal replay/conflict semantics.
    if (error?.code === 'P2002') {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: request.userId },
      });

      if (wallet) {
        const winner = await findReplay(
          prisma,
          wallet.id,
          request.idempotencyKeyHash,
        );
        if (winner) return replayResult(winner, request.requestHash);
      }
    }

    throw error;
  }
}

async function creditWallet(input) {
  return mutateWallet('credit', input);
}

async function debitWallet(input) {
  return mutateWallet('debit', input);
}

const WalletService = {
  getWallet,
  listTransactions,

  // INTERNAL ONLY.
  // Deliberately not exposed by wallet/routes.js or wallet/controller.js.
  creditWallet,
  debitWallet,
};

module.exports = {
  WalletService,
  money,
  walletDto,
  transactionDto,
  amountToPaise,
  decimalToPaise,
  paiseToMoney,
};
