'use strict';

const { prisma } = require('../../config/database');

async function findTransfers(filters = {}) {
  const where = {};

  if (filters.vehicleId) {
    where.carId = filters.vehicleId;
  }

  if (filters.fromBranchId) {
    where.fromBranchId = filters.fromBranchId;
  }

  if (filters.toBranchId) {
    where.toBranchId = filters.toBranchId;
  }

  if (filters.fromDate || filters.toDate) {
    where.transferDate = {};

    if (filters.fromDate) {
      where.transferDate.gte = new Date(
        `${filters.fromDate}T00:00:00.000+05:30`,
      );
    }

    if (filters.toDate) {
      where.transferDate.lte = new Date(
        `${filters.toDate}T23:59:59.999+05:30`,
      );
    }
  }

  return prisma.vehicleTransfer.findMany({
    where,
    orderBy: [
      {
        transferDate: 'desc',
      },
      {
        createdAt: 'desc',
      },
    ],
    select: {
      id: true,
      carId: true,
      fromBranchId: true,
      toBranchId: true,
      transferDate: true,
      reason: true,
      notes: true,
      createdAt: true,
      updatedAt: true,

      car: {
        select: {
          id: true,
          registrationNumber: true,
          brand: true,
          model: true,
          variant: true,
        },
      },

      fromBranch: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },

      toBranch: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },
    },
  });
}

async function findTransferById(id) {
  return prisma.vehicleTransfer.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      carId: true,
      fromBranchId: true,
      toBranchId: true,
      transferDate: true,
      reason: true,
      notes: true,
      createdAt: true,
      updatedAt: true,

      car: {
        select: {
          id: true,
          registrationNumber: true,
          brand: true,
          model: true,
          variant: true,
        },
      },

      fromBranch: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },

      toBranch: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },
    },
  });
}

async function findTransferHistory(vehicleId, filters = {}) {
  return findTransfers({
    ...filters,
    vehicleId,
  });
}

async function createTransfer(data) {
  return prisma.$transaction(async (tx) => {
    const car = await tx.car.findUnique({
      where: {
        id: data.vehicleId,
      },
      select: {
        id: true,
        vendorId: true,
        branchId: true,
        registrationNumber: true,
        brand: true,
        model: true,
        variant: true,
        isDeleted: true,
      },
    });

    if (!car || car.isDeleted) {
      const error = new Error('Vehicle not found.');
      error.statusCode = 404;
      throw error;
    }

    const fromBranchId = car.branchId;
    const toBranchId = data.toBranchId;

    if (fromBranchId === toBranchId) {
      const error = new Error(
        'Vehicle is already assigned to the selected branch.',
      );
      error.statusCode = 400;
      throw error;
    }

    const [fromBranch, toBranch] = await Promise.all([
      tx.branch.findUnique({
        where: {
          id: fromBranchId,
        },
        select: {
          id: true,
          name: true,
          city: true,
          vendorId: true,
          isOperational: true,
          isDeleted: true,
        },
      }),

      tx.branch.findUnique({
        where: {
          id: toBranchId,
        },
        select: {
          id: true,
          name: true,
          city: true,
          vendorId: true,
          isOperational: true,
          isDeleted: true,
        },
      }),
    ]);

    if (!fromBranch || fromBranch.isDeleted) {
      const error = new Error('Current vehicle branch not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!toBranch || toBranch.isDeleted) {
      const error = new Error('Destination branch not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!toBranch.isOperational) {
      const error = new Error(
        'Vehicle cannot be transferred to a non-operational branch.',
      );
      error.statusCode = 400;
      throw error;
    }

    if (fromBranch.vendorId !== toBranch.vendorId) {
      const error = new Error(
        'Vehicle can only be transferred between branches of the same vendor.',
      );
      error.statusCode = 400;
      throw error;
    }

    const transfer = await tx.vehicleTransfer.create({
      data: {
        carId: car.id,
        fromBranchId,
        toBranchId,
        transferDate: new Date(
          `${data.transferDate}T00:00:00.000+05:30`,
        ),
        reason: data.reason || null,
        notes: data.notes || null,
      },
      select: {
        id: true,
        carId: true,
        fromBranchId: true,
        toBranchId: true,
        transferDate: true,
        reason: true,
        notes: true,
        createdAt: true,
      },
    });

    await tx.car.update({
      where: {
        id: car.id,
      },
      data: {
        branchId: toBranchId,
      },
    });

    return {
      ...transfer,
      car: {
        id: car.id,
        registrationNumber: car.registrationNumber,
        brand: car.brand,
        model: car.model,
        variant: car.variant,
      },
      fromBranch: {
        id: fromBranch.id,
        name: fromBranch.name,
        city: fromBranch.city,
      },
      toBranch: {
        id: toBranch.id,
        name: toBranch.name,
        city: toBranch.city,
      },
    };
  });
}

module.exports = {
  findTransfers,
  findTransferById,
  findTransferHistory,
  createTransfer,
};
