'use strict';

const { prisma } = require('../../config/database');

const PaymentsRepository = {
  async listAdminPayments({
    skip = 0,
    take = 20,
    search,
    status,
    operationalStatus,
    provider,
    paymentMethod,
  } = {}) {
    const where = {};

    if (status) {
      where.status = status;
    }

    if (operationalStatus) {
      where.operationalStatus = operationalStatus;
    }

    if (provider) {
      where.provider = provider;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (search) {
      where.OR = [
        { id: { contains: search } },
        { bookingId: { contains: search } },
        { userId: { contains: search } },
        { providerOrderId: { contains: search } },
        { providerPaymentId: { contains: search } },
        { transactionReference: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      items,
      total,
    };
  },

  async findAdminPaymentById(paymentId) {
    return prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });
  },
};

module.exports = { PaymentsRepository };
