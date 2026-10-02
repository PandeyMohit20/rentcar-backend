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

/**
 * Admin wallet list.
 */
async function listAdminWallets({ skip, take, search, status }) {
  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.user = {
      OR: [
        {
          name: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
          },
        },
        {
          phone: {
            contains: search,
          },
        },
      ],
    };
  }

  const [wallets, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take,
    }),

    prisma.wallet.count({ where }),
  ]);

  return {
    wallets,
    total,
  };
}

/**
 * Admin wallet detail.
 */
async function findAdminWalletByUserId(userId) {
  return prisma.wallet.findUnique({
    where: {
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}

/**
 * Admin wallet transactions.
 */
async function listAdminTransactions(walletId, { skip, take }) {
  const where = {
    walletId,
  };

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    }),

    prisma.walletTransaction.count({
      where,
    }),
  ]);

  return {
    transactions,
    total,
  };
}

/**
 * Check whether user exists.
 */
async function findUserById(userId) {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
    },
  });
}

module.exports = {
  findByUserId,
  listTransactions,

  listAdminWallets,
  findAdminWalletByUserId,
  listAdminTransactions,
  findUserById,
};