'use strict';

const { prisma } = require('../../config/database');

function bookingWhere(filters = {}) {
  const where = {};

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};

    if (filters.startDate) {
      where.createdAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }

    if (filters.endDate) {
      where.createdAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  if (filters.branchId || filters.city) {
    where.car = {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.city
        ? {
            branch: {
              city: {
                equals: filters.city,
              },
            },
          }
        : {}),
    };
  }

  return where;
}

function paymentWhere(filters = {}) {
  const booking = bookingWhere(filters);

  return {
    status: 'succeeded',
    ...(Object.keys(booking).length ? { booking } : {}),
  };
}

const AnalyticsRepository = {
  async getBookings(filters) {
    return prisma.booking.findMany({
      where: bookingWhere(filters),
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        tax: true,
        discount: true,
        securityDeposit: true,
        totalAmount: true,
        currencyCode: true,
        createdAt: true,
        startAt: true,
        endAt: true,
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            registrationNumber: true,
            branch: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  async getSucceededPayments(filters) {
    return prisma.payment.findMany({
      where: paymentWhere(filters),
      select: {
        id: true,
        bookingId: true,
        amount: true,
        currencyCode: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  async getFleet() {
    return prisma.car.findMany({
      where: {
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        brand: true,
        model: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });
  },
};

module.exports = {
  AnalyticsRepository,
  bookingWhere,
};
