'use strict';

const { prisma } = require('../../config/database');

/**
 * Vendors repository.
 *
 * All Vendor database access is centralized here.
 * Controllers and services should never query Prisma directly.
 */
const VendorsRepository = {
  // ------------------------------------------------------------
  // Vendor
  // ------------------------------------------------------------

  async findById(id) {
    return prisma.vendor.findUnique({
      where: { id },
    });
  },

  async findByIdWithRelations(id) {
    return prisma.vendor.findUnique({
      where: { id },
      include: {
        documents: true,
        bankAccounts: true,
        branches: true,
        locations: true,
      },
    });
  },

  async findByCode(vendorCode) {
    return prisma.vendor.findUnique({
      where: { vendorCode },
    });
  },

  async findLastVendorByCode() {
  return prisma.vendor.findFirst({
    where: {
      vendorCode: {
        startsWith: 'VND-',
      },
    },
    orderBy: {
      vendorCode: 'desc',
    },
  });
},

  async findByEmail(email) {
    return prisma.vendor.findFirst({
      where: {
        email,
        isDeleted: false,
      },
    });
  },

  async findByPhone(phone) {
    return prisma.vendor.findFirst({
      where: {
        phone,
        isDeleted: false,
      },
    });
  },

  // ------------------------------------------------------------
  // List / Count
  // ------------------------------------------------------------

  async findMany({
    where = {},
    skip = 0,
    take = 10,
    orderBy = { createdAt: 'desc' },
  }) {
    return prisma.vendor.findMany({
      where,
      skip,
      take,
      orderBy,
    });
  },

  async findManyWithRelations({
    where = {},
    skip = 0,
    take = 10,
    orderBy = { createdAt: 'desc' },
  }) {
    return prisma.vendor.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        documents: true,
        bankAccounts: true,
        branches: true,
        locations: true,
      },
    });
  },

  async count(where = {}) {
    return prisma.vendor.count({
      where,
    });
  },

  // ------------------------------------------------------------
  // Create
  // ------------------------------------------------------------

  async create(data) {
    return prisma.vendor.create({
      data,
    });
  },

  async createWithRelations(data) {
    return prisma.vendor.create({
      data,
      include: {
        documents: true,
        bankAccounts: true,
        branches: true,
        locations: true,
      },
    });
  },

  // ------------------------------------------------------------
  // Update
  // ------------------------------------------------------------

  async update(id, data) {
    return prisma.vendor.update({
      where: { id },
      data,
    });
  },

  async updateWithRelations(id, data) {
    return prisma.vendor.update({
      where: { id },
      data,
      include: {
        documents: true,
        bankAccounts: true,
        branches: true,
        locations: true,
      },
    });
  },

  // ------------------------------------------------------------
  // Soft Delete
  // ------------------------------------------------------------

  async softDelete(id) {
    return prisma.vendor.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: 'inactive',
      },
    });
  },

  // ------------------------------------------------------------
  // Status / Verification
  // ------------------------------------------------------------

  async updateStatus(id, status) {
    return prisma.vendor.update({
      where: { id },
      data: {
        status,
      },
    });
  },

  async updateVerificationStatus(id, verificationStatus) {
    return prisma.vendor.update({
      where: { id },
      data: {
        verificationStatus,
      },
    });
  },

  // ------------------------------------------------------------
  // Vendor Documents
  // ------------------------------------------------------------

  async findDocumentsByVendorId(vendorId) {
    return prisma.vendorDocument.findMany({
      where: {
        vendorId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async findDocumentById(id) {
    return prisma.vendorDocument.findUnique({
      where: { id },
    });
  },

  async createDocument(data) {
    return prisma.vendorDocument.create({
      data,
    });
  },

  async updateDocument(id, data) {
    return prisma.vendorDocument.update({
      where: { id },
      data,
    });
  },

  async deleteDocument(id) {
    return prisma.vendorDocument.delete({
      where: { id },
    });
  },

// ------------------------------------------------------------
// Vendor Fleet
// ------------------------------------------------------------

async findCarsByVendorId(vendorId) {
  return prisma.car.findMany({
    where: {
      vendorId,
      isDeleted: false,
    },
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
      branchId: true,
      createdAt: true,
      updatedAt: true,
      images: {
        where: {
          isPrimary: true,
        },
        take: 1,
        select: {
          id: true,
          imageUrl: true,
          altText: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
},

// ------------------------------------------------------------
// Vendor Bookings
// ------------------------------------------------------------

async findBookingsByVendorId({
  vendorId,
  where = {},
  skip = 0,
  take = 10,
}) {
  return prisma.booking.findMany({
    where: {
      vendorId,
      ...where,
    },

    skip,
    take,

    orderBy: {
      createdAt: 'desc',
    },

    select: {
      id: true,
      bookingNumber: true,
      userId: true,
      vendorId: true,
      carId: true,

      startAt: true,
      endAt: true,

      subtotal: true,
      tax: true,
      discount: true,
      securityDeposit: true,
      totalAmount: true,
      currencyCode: true,

      status: true,
      paymentStatus: true,

      holdExpiresAt: true,
      cancelledAt: true,
      cancellationReason: true,

      createdAt: true,
      updatedAt: true,

      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },

      car: {
        select: {
          id: true,
          registrationNumber: true,
          brand: true,
          model: true,
          variant: true,
          status: true,
        },
      },

      payments: {
  select: {
    id: true,
    amount: true,
    currencyCode: true,
    paymentMethod: true,
    provider: true,
    providerOrderId: true,
    providerPaymentId: true,
    status: true,
    operationalStatus: true,
    transactionReference: true,
    paidAt: true,
    failedAt: true,
    createdAt: true,
  },
  orderBy: {
    createdAt: 'desc',
  },
},
    },
  });
},

async countBookingsByVendorId({
  vendorId,
  where = {},
}) {
  return prisma.booking.count({
    where: {
      vendorId,
      ...where,
    },
  });
},

  // ------------------------------------------------------------
  // Vendor Bank Accounts
  // ------------------------------------------------------------

  async findBankAccountsByVendorId(vendorId) {
    return prisma.vendorBankAccount.findMany({
      where: {
        vendorId,
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  },

  async findBankAccountById(id) {
    return prisma.vendorBankAccount.findUnique({
      where: { id },
    });
  },

  async createBankAccount(data) {
    return prisma.vendorBankAccount.create({
      data,
    });
  },

  async updateBankAccount(id, data) {
    return prisma.vendorBankAccount.update({
      where: { id },
      data,
    });
  },

  async deleteBankAccount(id) {
    return prisma.vendorBankAccount.delete({
      where: { id },
    });
  },

  async clearDefaultBankAccounts(vendorId) {
    return prisma.vendorBankAccount.updateMany({
      where: {
        vendorId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  },
};

module.exports = { VendorsRepository };