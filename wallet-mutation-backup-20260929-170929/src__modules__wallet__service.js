'use strict';

const { parsePagination, buildMeta, computeTotalPages } = require('../../utils/pagination');
const repository = require('./repository');
const { DEFAULT_CURRENCY, DEFAULT_STATUS } = require('./constants');

function money(value) {
  if (value === null || value === undefined) return '0.00';

  if (typeof value === 'object' && typeof value.toFixed === 'function') {
    return value.toFixed(2);
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
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

const WalletService = {
  getWallet,
  listTransactions,
};

module.exports = {
  WalletService,
  money,
  walletDto,
  transactionDto,
};
