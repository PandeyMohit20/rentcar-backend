'use strict';

const { prisma } = require('../../config/database');

const BOOKING_STATUSES = [
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
];

function startOfDay(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function endOfDay(dateString) {
  return new Date(`${dateString}T23:59:59.999Z`);
}

const UtilizationRepository = {
  async getFleet(filters = {}) {
    const where = {
      isDeleted: false,
    };

    if (filters.vehicleId) {
      where.id = filters.vehicleId;
    }

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    return prisma.car.findMany({
      where,
      select: {
        id: true,
        vendorId: true,
        branchId: true,
        registrationNumber: true,
        brand: true,
        model: true,
        variant: true,
        status: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        vendor: {
          select: {
            id: true,
            companyName: true,
            vendorCode: true,
          },
        },
      },
      orderBy: [
        { brand: 'asc' },
        { model: 'asc' },
        { registrationNumber: 'asc' },
      ],
    });
  },

  async getBookings(filters = {}) {
    const rangeStart = startOfDay(filters.startDate);
    const rangeEnd = endOfDay(filters.endDate);

    const where = {
      status: {
        in: BOOKING_STATUSES,
      },

      // Booking overlaps selected utilization period.
      startAt: {
        lt: rangeEnd,
      },

      endAt: {
        gt: rangeStart,
      },
    };

    if (filters.vehicleId) {
      where.carId = filters.vehicleId;
    }

    if (filters.branchId) {
      where.car = {
        branchId: filters.branchId,
      };
    }

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    return prisma.booking.findMany({
      where,
      select: {
        id: true,
        bookingNumber: true,
        carId: true,
        vendorId: true,
        status: true,
        startAt: true,
        endAt: true,

        car: {
          select: {
            id: true,
            registrationNumber: true,
            brand: true,
            model: true,
            variant: true,
            branchId: true,

            branch: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },

            vendor: {
              select: {
                id: true,
                companyName: true,
                vendorCode: true,
              },
            },
          },
        },
      },

      orderBy: {
        startAt: 'asc',
      },
    });
  },
};

module.exports = {
  UtilizationRepository,
};