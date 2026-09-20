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
  ...where,
  vendorId,
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
  ...where,
  vendorId,
},
  });
},

// ------------------------------------------------------------
// Vendor Staff / Members
// ------------------------------------------------------------

// ------------------------------------------------------------
// Vendor Settlements
// ------------------------------------------------------------

async findSettlementsByVendorId({
  vendorId,
  where = {},
  skip = 0,
  take = 20,
}) {
  return prisma.vendorSettlement.findMany({
    where: {
      ...where,
      vendorId,
    },

    skip,
    take,

    orderBy: {
      createdAt: 'desc',
    },

    select: {
      id: true,
      settlementNumber: true,
      vendorId: true,
      bankAccountId: true,

      periodStart: true,
      periodEnd: true,

      grossCollected: true,
      refundAmount: true,
      commissionAmount: true,
      securityDeposit: true,
      adjustmentAmount: true,
      netPayable: true,

      currencyCode: true,
      status: true,

      payoutReference: true,
      processedAt: true,
      failedAt: true,
      failureReason: true,

      createdAt: true,
      updatedAt: true,

      bankAccount: {
        select: {
          id: true,
          accountHolder: true,
          bankName: true,
          accountNumber: true,
          ifscCode: true,
          swiftCode: true,
          currencyCode: true,
          isDefault: true,
          status: true,
        },
      },

      items: {
        orderBy: {
          createdAt: 'asc',
        },

        select: {
          id: true,
          bookingId: true,
          paymentId: true,

          grossAmount: true,
          refundAmount: true,
          commissionAmount: true,
          securityDeposit: true,
          netAmount: true,
          currencyCode: true,
          createdAt: true,

          booking: {
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

              vendorCommissionRate: true,
              vendorCommision: true,
            },
          },
        },
      },
    },
  });
},

async countSettlementsByVendorId({
  vendorId,
  where = {},
}) {
  return prisma.vendorSettlement.count({
    where: {
      ...where,
      vendorId,
    },
  });
},
async findMembersByVendorId(vendorId) {
  return prisma.vendorMember.findMany({
    where: {
      vendorId,
    },
    select: {
      id: true,
      vendorId: true,
      userId: true,
      isOwner: true,
      createdAt: true,
      updatedAt: true,

      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },

    orderBy: [
      {
        isOwner: 'desc',
      },
      {
        createdAt: 'asc',
      },
    ],
  });
},

// ------------------------------------------------------------
// Vendor Revenue
// ------------------------------------------------------------

async findRevenueBookingsByVendorId(vendorId) {
  return prisma.booking.findMany({
    where: {
      vendorId,
    },

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
      vendorCommision: true,
      currencyCode: true,

      startAt: true,
      endAt: true,
      createdAt: true,

      payments: {
        where: {
          status: {
            in: ['succeeded', 'refunded'],
          },
        },

        select: {
          id: true,
          amount: true,
          status: true,
          currencyCode: true,
          paidAt: true,
          createdAt: true,

          refunds: {
            select: {
              id: true,
              amount: true,
              status: true,
              processedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },

    orderBy: {
      createdAt: 'desc',
    },
  });
},

// ------------------------------------------------------------
// Vendor Sessions
// ------------------------------------------------------------

async findSessionsByVendorId(vendorId) {
  const members = await prisma.vendorMember.findMany({
    where: {
      vendorId,
    },

    select: {
      userId: true,
    },
  });

  const userIds = members.map((member) => member.userId);

  if (!userIds.length) {
    return [];
  }

  return prisma.session.findMany({
    where: {
      userId: {
        in: userIds,
      },
    },

    select: {
      id: true,
      userId: true,
      expiresAt: true,
      lastActiveAt: true,
      ipAddress: true,
      userAgent: true,
      deviceSource: true,
      createdAt: true,
      revokedAt: true,

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
      lastActiveAt: 'desc',
    },

    take: 100,
  });
},

// ------------------------------------------------------------
// Vendor Activity
// ------------------------------------------------------------

async findActivityContextByVendorId(vendorId) {
  const [members, bookings] = await Promise.all([
    prisma.vendorMember.findMany({
      where: {
        vendorId,
      },
      select: {
        userId: true,
      },
    }),

    prisma.booking.findMany({
      where: {
        vendorId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  return {
    userIds: members.map((member) => member.userId),
    bookingIds: bookings.map((booking) => booking.id),
  };
},

async findActivityLogsByVendorId(vendorId) {
  const context =
    await this.findActivityContextByVendorId(vendorId);

  const conditions = [
    {
      entityId: vendorId,
    },
  ];

  if (context.userIds.length) {
    conditions.push({
      userId: {
        in: context.userIds,
      },
    });
  }

  if (context.bookingIds.length) {
    conditions.push({
      entityId: {
        in: context.bookingIds,
      },
    });
  }

  const [activityLogs, auditLogs] =
    await Promise.all([
      prisma.activityLog.findMany({
        where: {
          OR: conditions,
        },

        select: {
          id: true,
          userId: true,
          action: true,
          module: true,
          entity: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 100,
      }),

      prisma.auditLog.findMany({
        where: {
          OR: conditions,
        },

        select: {
          id: true,
          userId: true,
          action: true,
          module: true,
          entity: true,
          entityId: true,
          result: true,
          metadata: true,
          requestId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 100,
      }),
    ]);

  return {
    activityLogs,
    auditLogs,
  };
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