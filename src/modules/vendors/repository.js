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