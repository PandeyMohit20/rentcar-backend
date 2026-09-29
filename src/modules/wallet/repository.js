'use strict';

const { prisma } = require('../../config/database');

async function findByUserId(userId) {
  return prisma.wallet.findUnique({
    where: { userId },
  });
}

async function listTransactions(walletId, { skip, take }) {
  const where = { walletId };

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return { transactions, total };
}

module.exports = {
  findByUserId,
  listTransactions,
};
