'use strict';

const { prisma } = require('../../config/database');

function dateRange(filters = {}, field = 'createdAt') {
  if (!filters.startDate && !filters.endDate) {
    return undefined;
  }

  const range = {};

  if (filters.startDate) {
    range.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
  }

  if (filters.endDate) {
    range.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
  }

  return {
    [field]: range,
  };
}

function bookingWhere(filters = {}) {
  const where = {};

  const createdAtRange = dateRange(filters, 'createdAt');

  if (createdAtRange) {
    Object.assign(where, createdAtRange);
  }

  if (filters.vendorId) {
    where.vendorId = filters.vendorId;
  }

  if (filters.carId) {
    where.carId = filters.carId;
  }

  if (filters.bookingStatus) {
    where.status = filters.bookingStatus;
  }

  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus;
  }

  if (filters.branchId || filters.city) {
    where.car = {
      ...(filters.branchId
        ? {
            branchId: filters.branchId,
          }
        : {}),
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
  const where = {
    status: 'succeeded',
  };

  const paidAtRange = dateRange(filters, 'paidAt');

  if (paidAtRange) {
    Object.assign(where, paidAtRange);
  }

  if (filters.vendorId) {
    where.booking = {
      vendorId: filters.vendorId,
    };
  }

  if (filters.carId) {
    where.booking = {
      ...(where.booking || {}),
      carId: filters.carId,
    };
  }

  if (filters.bookingStatus) {
    where.booking = {
      ...(where.booking || {}),
      status: filters.bookingStatus,
    };
  }

  if (filters.paymentStatus) {
    where.booking = {
      ...(where.booking || {}),
      paymentStatus: filters.paymentStatus,
    };
  }

  if (filters.branchId || filters.city) {
    where.booking = {
      ...(where.booking || {}),
      car: {
        ...(filters.branchId
          ? {
              branchId: filters.branchId,
            }
          : {}),
        ...(filters.city
          ? {
              branch: {
                city: {
                  equals: filters.city,
                },
              },
            }
          : {}),
      },
    };
  }

  return where;
}

function refundWhere(filters = {}) {
  const where = {
    status: 'succeeded',
  };

  const processedAtRange = dateRange(filters, 'processedAt');

  if (processedAtRange) {
    Object.assign(where, processedAtRange);
  }

  if (filters.vendorId) {
    where.booking = {
      vendorId: filters.vendorId,
    };
  }

  if (filters.carId) {
    where.booking = {
      ...(where.booking || {}),
      carId: filters.carId,
    };
  }

  if (filters.bookingStatus) {
    where.booking = {
      ...(where.booking || {}),
      status: filters.bookingStatus,
    };
  }

  if (filters.paymentStatus) {
    where.booking = {
      ...(where.booking || {}),
      paymentStatus: filters.paymentStatus,
    };
  }

  if (filters.branchId || filters.city) {
    where.booking = {
      ...(where.booking || {}),
      car: {
        ...(filters.branchId
          ? {
              branchId: filters.branchId,
            }
          : {}),
        ...(filters.city
          ? {
              branch: {
                city: {
                  equals: filters.city,
                },
              },
            }
          : {}),
      },
    };
  }

  return where;
}

function userWhere(filters = {}) {
  const where = {
    isDeleted: false,
  };

  const createdAtRange = dateRange(filters, 'createdAt');

  if (createdAtRange) {
    Object.assign(where, createdAtRange);
  }

  return where;
}

const AnalyticsRepository = {
  async getBookings(filters = {}) {
    return prisma.booking.findMany({
      where: bookingWhere(filters),
      select: {
        id: true,
        bookingNumber: true,
        vendorId: true,
        carId: true,
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
            vendorId: true,
            branchId: true,
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

  async getSucceededPayments(filters = {}) {
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
      orderBy: [
        {
          paidAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  },

  async getSucceededRefunds(filters = {}) {
    return prisma.refund.findMany({
      where: refundWhere(filters),
      select: {
        id: true,
        paymentId: true,
        bookingId: true,
        amount: true,
        currencyCode: true,
        processedAt: true,
        createdAt: true,
      },
      orderBy: [
        {
          processedAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  },

  async getCustomers(filters = {}) {
    return prisma.user.findMany({
      where: userWhere(filters),
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  async getFleet(filters = {}) {
    const where = {
      isDeleted: false,
    };

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters.carId) {
      where.id = filters.carId;
    }

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.city) {
      where.branch = {
        city: {
          equals: filters.city,
        },
      };
    }

    return prisma.car.findMany({
      where,
      select: {
        id: true,
        vendorId: true,
        status: true,
        brand: true,
        model: true,
        registrationNumber: true,
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
  paymentWhere,
  refundWhere,
  userWhere,
};