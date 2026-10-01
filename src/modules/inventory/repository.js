'use strict';

const { prisma } = require('../../config/database');

function buildWhere(filters = {}) {
  const where = {
    isDeleted: false,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.vendorId) {
    where.vendorId = filters.vendorId;
  }

  if (filters.branchId) {
    where.branchId = filters.branchId;
  }

  if (filters.search) {
    where.OR = [
      {
        registrationNumber: {
          contains: filters.search,
        },
      },
      {
        brand: {
          contains: filters.search,
        },
      },
      {
        model: {
          contains: filters.search,
        },
      },
      {
        variant: {
          contains: filters.search,
        },
      },
    ];
  }

  return where;
}

async function findInventory(filters = {}) {
  return prisma.car.findMany({
    where: buildWhere(filters),

    orderBy: [
      {
        brand: 'asc',
      },
      {
        model: 'asc',
      },
      {
        registrationNumber: 'asc',
      },
    ],

    select: {
      id: true,
      registrationNumber: true,
      brand: true,
      model: true,
      variant: true,
      manufacturingYear: true,
      fuelType: true,
      transmission: true,
      seatingCapacity: true,
      status: true,
      odometer: true,
      createdAt: true,
      updatedAt: true,

      vendor: {
        select: {
          id: true,
          companyName: true,
          legalName: true,
        },
      },

      branch: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },

      images: {
        orderBy: {
          sortOrder: 'asc',
        },
        take: 1,
        select: {
          id: true,
          imageUrl: true,
          isPrimary: true,
        },
      },

      availabilities: {
        orderBy: {
          date: 'desc',
        },
        take: 1,
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          reason: true,
        },
      },

      _count: {
        select: {
          bookings: true,
        },
      },
    },
  });
}

async function getStatusCounts() {
  return prisma.car.groupBy({
    by: ['status'],

    where: {
      isDeleted: false,
    },

    _count: {
      _all: true,
    },
  });
}

async function countCars() {
  return prisma.car.count({
    where: {
      isDeleted: false,
    },
  });
}

/**
 * Inventory calendar data.
 *
 * Booking overlap rule:
 * booking.startAt < rangeEnd
 * AND booking.endAt > rangeStart
 *
 * Availability configuration is date based and therefore uses
 * the inclusive requested business-date range.
 */
async function findCalendarData(filters) {
  const carWhere = {
    isDeleted: false,
  };

  if (filters.vendorId) {
    carWhere.vendorId = filters.vendorId;
  }

  if (filters.branchId) {
    carWhere.branchId = filters.branchId;
  }

  if (filters.carId) {
    carWhere.id = filters.carId;
  }

  const cars = await prisma.car.findMany({
    where: carWhere,

    orderBy: [
      {
        brand: 'asc',
      },
      {
        model: 'asc',
      },
      {
        registrationNumber: 'asc',
      },
    ],

    select: {
      id: true,
      registrationNumber: true,
      brand: true,
      model: true,
      variant: true,
      status: true,

      vendorId: true,
      branchId: true,

      vendor: {
        select: {
          id: true,
          companyName: true,
          legalName: true,
        },
      },

      branch: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },
    },
  });

  const carIds = cars.map((car) => car.id);

  if (!carIds.length) {
    return {
      cars: [],
      bookings: [],
      availabilities: [],
    };
  }

  const rangeStart = new Date(`${filters.startDate}T00:00:00.000+05:30`);

  const rangeEnd = new Date(`${filters.endDate}T00:00:00.000+05:30`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const availabilityStart = new Date(`${filters.startDate}T00:00:00.000+05:30`);

  const availabilityEnd = new Date(`${filters.endDate}T23:59:59.999+05:30`);

  const [bookings, availabilities] = await Promise.all([
    prisma.booking.findMany({
      where: {
        carId: {
          in: carIds,
        },

        startAt: {
          lt: rangeEnd,
        },

        endAt: {
          gt: rangeStart,
        },
      },

      orderBy: {
        startAt: 'asc',
      },

      select: {
        id: true,
        bookingNumber: true,
        carId: true,
        userId: true,
        vendorId: true,
        status: true,
        paymentStatus: true,
        startAt: true,
        endAt: true,
        holdExpiresAt: true,
        totalAmount: true,
        currencyCode: true,
      },
    }),

    prisma.carAvailability.findMany({
      where: {
        carId: {
          in: carIds,
        },

        date: {
          gte: availabilityStart,
          lte: availabilityEnd,
        },
      },

      orderBy: {
        date: 'asc',
      },

      select: {
        id: true,
        carId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        reason: true,
      },
    }),
  ]);

  return {
    cars,
    bookings,
    availabilities,
  };
}

module.exports = {
  buildWhere,
  findInventory,
  getStatusCounts,
  countCars,
  findCalendarData,
};
