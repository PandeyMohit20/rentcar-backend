'use strict';

const { VendorsRepository } = require('./repository');

const VENDOR_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'companyName',
  'vendorCode',
  'status',
  'verificationStatus',
];

function toVendorDocumentResponse(document) {
  if (!document) return document;
  const safeDocument = { ...document };
  delete safeDocument.documentUrl;
  delete safeDocument.verifiedAt;
  delete safeDocument.verifiedBy;
  delete safeDocument.rejectionReason;
  return safeDocument;
}

const VendorsService = {
  // ------------------------------------------------------------
  // Create
  // ------------------------------------------------------------

  async createVendor(data = {}) {
    // ----------------------------------------------------------
    // Map frontend fields to backend/database fields
    // Frontend:
    //   businessName
    //   ownerName
    //   registrationNumber
    //
    // Database:
    //   companyName
    //   legalName
    //   taxId
    // ----------------------------------------------------------

    const companyName = data.companyName ?? data.businessName;
    const legalName = data.legalName ?? data.ownerName;
    const taxId = data.taxId ?? data.registrationNumber;

    // companyName is required
    if (!companyName || !String(companyName).trim()) {
      const error = new Error('Business name is required.');
      error.statusCode = 400;
      throw error;
    }

    // ----------------------------------------------------------
    // Generate vendor code automatically
    // ----------------------------------------------------------

    let vendorCode = data.vendorCode?.trim();

    if (!vendorCode) {
      const lastVendor =
        await VendorsRepository.findLastVendorByCode();

      let nextNumber = 1;

      if (lastVendor?.vendorCode) {
        const match =
          lastVendor.vendorCode.match(/^VND-(\d+)$/);

        if (match) {
          nextNumber = Number(match[1]) + 1;
        }
      }

      vendorCode =
        `VND-${String(nextNumber).padStart(6, '0')}`;
    }

    // ----------------------------------------------------------
    // Check vendor code uniqueness
    // ----------------------------------------------------------

    const existingCode =
      await VendorsRepository.findByCode(vendorCode);

    if (existingCode && !existingCode.isDeleted) {
      const error = new Error(
        'Vendor with this vendor code already exists.',
      );

      error.statusCode = 409;
      throw error;
    }

    // ----------------------------------------------------------
    // Check email uniqueness
    // ----------------------------------------------------------

    if (data.email) {
      const existingEmail =
        await VendorsRepository.findByEmail(data.email);

      if (existingEmail) {
        const error = new Error(
          'Vendor with this email already exists.',
        );

        error.statusCode = 409;
        throw error;
      }
    }

    // ----------------------------------------------------------
    // Check phone uniqueness
    // ----------------------------------------------------------

    if (data.phone) {
      const existingPhone =
        await VendorsRepository.findByPhone(data.phone);

      if (existingPhone) {
        const error = new Error(
          'Vendor with this phone already exists.',
        );

        error.statusCode = 409;
        throw error;
      }
    }

    // ----------------------------------------------------------
    // Create vendor
    // ----------------------------------------------------------

    const vendor = await VendorsRepository.create({
      vendorCode,

      companyName: String(companyName).trim(),

      legalName: legalName
        ? String(legalName).trim()
        : null,

      email: data.email
        ? String(data.email).trim().toLowerCase()
        : null,

      phone: data.phone
        ? String(data.phone).trim()
        : null,

      website: data.website ?? null,

      taxId: taxId
        ? String(taxId).trim()
        : null,

      gstin: data.gstin ?? null,

      verificationStatus: 'pending',

      commissionRate:
        data.commissionRate ?? 10,

      status:
        data.status ?? 'pending',

      isDeleted: false,
    });

    return this._formatVendor(vendor);
  },

  // ------------------------------------------------------------
  // Get
  // ------------------------------------------------------------

  async getVendorById(vendorId) {
    const vendor =
      await VendorsRepository.findByIdWithRelations(vendorId);

    if (!vendor || vendor.isDeleted) {
      const error = new Error('Vendor not found.');
      error.statusCode = 404;
      throw error;
    }

    return this._formatVendor(vendor);
  },

  // ------------------------------------------------------------
  // List
  // ------------------------------------------------------------

  async listVendors(filters = {}) {
    const {
      search,
      vendorCode,
      email,
      phone,
      status,
      verificationStatus,
      createdFrom,
      createdTo,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        {
          vendorCode: {
            contains: search,
          },
        },
        {
          companyName: {
            contains: search,
          },
        },
        {
          legalName: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
          },
        },
      ];
    }

    if (vendorCode) {
      where.vendorCode = {
        contains: vendorCode,
      };
    }

    if (email) {
      where.email = email;
    }

    if (phone) {
      where.phone = phone;
    }

    if (status) {
      where.status = status;
    }

    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }

    if (createdFrom || createdTo) {
      where.createdAt = {};

      if (createdFrom) {
        where.createdAt.gte = new Date(createdFrom);
      }

      if (createdTo) {
        where.createdAt.lte = new Date(createdTo);
      }
    }

    const safeSortBy =
      VENDOR_SORT_FIELDS.includes(sortBy)
        ? sortBy
        : 'createdAt';

    const safeSortOrder =
      sortOrder === 'asc'
        ? 'asc'
        : 'desc';

    const safePage =
      Math.max(Number(page) || 1, 1);

    const safeLimit =
      Math.max(Number(limit) || 10, 1);

    const skip =
      (safePage - 1) * safeLimit;

    const [vendors, total] =
      await Promise.all([
        VendorsRepository.findMany({
          where,
          skip,
          take: safeLimit,
          orderBy: {
            [safeSortBy]: safeSortOrder,
          },
        }),

        VendorsRepository.count(where),
      ]);

    return {
      data: vendors.map((vendor) =>
        this._formatVendor(vendor),
      ),

      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(
          total / safeLimit,
        ),
      },
    };
  },

  // ------------------------------------------------------------
  // Update
  // ------------------------------------------------------------

  async updateVendor(vendorId, data = {}) {
    const existingVendor =
      await VendorsRepository.findById(vendorId);

    if (!existingVendor || existingVendor.isDeleted) {
      const error = new Error('Vendor not found.');
      error.statusCode = 404;
      throw error;
    }

    // ----------------------------------------------------------
    // Map frontend fields during update as well
    // ----------------------------------------------------------

    const normalizedData = {
      ...data,

      ...(data.businessName !== undefined &&
        data.companyName === undefined
        ? {
            companyName: data.businessName,
          }
        : {}),

      ...(data.ownerName !== undefined &&
        data.legalName === undefined
        ? {
            legalName: data.ownerName,
          }
        : {}),

      ...(data.registrationNumber !== undefined &&
        data.taxId === undefined
        ? {
            taxId: data.registrationNumber,
          }
        : {}),
    };

    // ----------------------------------------------------------
    // Vendor code uniqueness
    // ----------------------------------------------------------

    if (
      normalizedData.vendorCode &&
      normalizedData.vendorCode !==
        existingVendor.vendorCode
    ) {
      const vendorWithSameCode =
        await VendorsRepository.findByCode(
          normalizedData.vendorCode,
        );

      if (
        vendorWithSameCode &&
        vendorWithSameCode.id !== vendorId &&
        !vendorWithSameCode.isDeleted
      ) {
        const error = new Error(
          'Vendor with this vendor code already exists.',
        );

        error.statusCode = 409;
        throw error;
      }
    }

    // ----------------------------------------------------------
    // Email uniqueness
    // ----------------------------------------------------------

    if (
      normalizedData.email &&
      normalizedData.email !== existingVendor.email
    ) {
      const vendorWithSameEmail =
        await VendorsRepository.findByEmail(
          normalizedData.email,
        );

      if (
        vendorWithSameEmail &&
        vendorWithSameEmail.id !== vendorId
      ) {
        const error = new Error(
          'Vendor with this email already exists.',
        );

        error.statusCode = 409;
        throw error;
      }
    }

    // ----------------------------------------------------------
    // Phone uniqueness
    // ----------------------------------------------------------

    if (
      normalizedData.phone &&
      normalizedData.phone !== existingVendor.phone
    ) {
      const vendorWithSamePhone =
        await VendorsRepository.findByPhone(
          normalizedData.phone,
        );

      if (
        vendorWithSamePhone &&
        vendorWithSamePhone.id !== vendorId
      ) {
        const error = new Error(
          'Vendor with this phone already exists.',
        );

        error.statusCode = 409;
        throw error;
      }
    }

    // ----------------------------------------------------------
    // Allowed fields
    // ----------------------------------------------------------

    const allowedFields = [
      'vendorCode',
      'companyName',
      'legalName',
      'email',
      'phone',
      'website',
      'taxId',
      'gstin',
      'commissionRate',
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (normalizedData[field] !== undefined) {
        updateData[field] =
          normalizedData[field];
      }
    }

    // Status is handled by updateStatus endpoint.
    // Do not update it here.

    const vendor =
      await VendorsRepository.updateWithRelations(
        vendorId,
        updateData,
      );

    return this._formatVendor(vendor);
  },

  // ------------------------------------------------------------
  // Status
  // ------------------------------------------------------------

  async updateStatus(vendorId, status) {
    const existingVendor =
      await VendorsRepository.findById(vendorId);

    if (!existingVendor || existingVendor.isDeleted) {
      const error = new Error('Vendor not found.');
      error.statusCode = 404;
      throw error;
    }

    const vendor =
      await VendorsRepository.updateStatus(
        vendorId,
        status,
      );

    return this._formatVendor(vendor);
  },

  // ------------------------------------------------------------
  // Verification
  // ------------------------------------------------------------

  async updateVerificationStatus(
    vendorId,
    verificationStatus,
  ) {
    const existingVendor =
      await VendorsRepository.findById(vendorId);

    if (!existingVendor || existingVendor.isDeleted) {
      const error = new Error('Vendor not found.');
      error.statusCode = 404;
      throw error;
    }

    const vendor =
      await VendorsRepository.updateVerificationStatus(
        vendorId,
        verificationStatus,
      );

    return this._formatVendor(vendor);
  },

  // ------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------

  async deleteVendor(vendorId) {
    const existingVendor =
      await VendorsRepository.findById(vendorId);

    if (!existingVendor || existingVendor.isDeleted) {
      const error = new Error('Vendor not found.');
      error.statusCode = 404;
      throw error;
    }

    await VendorsRepository.softDelete(vendorId);

    return {
      message: 'Vendor deleted successfully.',
    };
  },

  // ------------------------------------------------------------
  // Documents
  // ------------------------------------------------------------

  async listDocuments(vendorId) {
    await this._ensureVendorExists(vendorId);

    const documents = await VendorsRepository.findDocumentsByVendorId(vendorId);
    return documents.map(toVendorDocumentResponse);
  },

  async getDocument(documentId) {
    const document =
      await VendorsRepository.findDocumentById(
        documentId,
      );

    if (!document) {
      const error = new Error(
        'Vendor document not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    return document;
  },

  async createDocument(vendorId, data = {}) {
    await this._ensureVendorExists(vendorId);

    const document = await VendorsRepository.createDocument({
      vendorId,
      documentType: data.documentType,
      documentUrl: data.documentUrl,
      status: data.status ?? 'pending',
      issuedAt: data.issuedAt ?? null,
      expiresAt: data.expiresAt ?? null,
      remarks: data.remarks ?? null,
    });
    return toVendorDocumentResponse(document);
  },

  async updateDocument(documentId, data) {
    const document =
      await VendorsRepository.findDocumentById(
        documentId,
      );

    if (!document) {
      const error = new Error(
        'Vendor document not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    const updated = await VendorsRepository.updateDocument(
      documentId,
      data,
    );
    return toVendorDocumentResponse(updated);
  },

  async deleteDocument(documentId) {
    const document =
      await VendorsRepository.findDocumentById(
        documentId,
      );

    if (!document) {
      const error = new Error(
        'Vendor document not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    await VendorsRepository.deleteDocument(
      documentId,
    );

    return {
      message:
        'Vendor document deleted successfully.',
    };
  },

  // ------------------------------------------------------------
  // Bank Accounts
  // ------------------------------------------------------------

  async listBankAccounts(vendorId) {
    await this._ensureVendorExists(vendorId);

    return VendorsRepository.findBankAccountsByVendorId(
      vendorId,
    );
  },

  async getBankAccount(bankAccountId) {
    const account =
      await VendorsRepository.findBankAccountById(
        bankAccountId,
      );

    if (!account) {
      const error = new Error(
        'Vendor bank account not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    return account;
  },

  async createBankAccount(
    vendorId,
    data = {},
  ) {
    await this._ensureVendorExists(vendorId);

    const { prisma } = require('../../config/database');
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.vendorBankAccount.updateMany({
          where: { vendorId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.vendorBankAccount.create({ data: {
        vendorId, accountHolder: data.accountHolder, bankName: data.bankName,
        accountNumber: data.accountNumber, ifscCode: data.ifscCode ?? null,
        swiftCode: data.swiftCode ?? null, currencyCode: data.currencyCode ?? 'INR',
        isDefault: data.isDefault ?? false, status: data.status ?? 'active',
      } });
    });
  },

  async updateBankAccount(
    bankAccountId,
    data,
  ) {
    const existingAccount =
      await VendorsRepository.findBankAccountById(
        bankAccountId,
      );

    if (!existingAccount) {
      const error = new Error(
        'Vendor bank account not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    const { prisma } = require('../../config/database');
    return prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.vendorBankAccount.updateMany({
          where: { vendorId: existingAccount.vendorId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.vendorBankAccount.update({ where: { id: bankAccountId }, data });
    });
  },

  async deleteBankAccount(bankAccountId) {
    const existingAccount =
      await VendorsRepository.findBankAccountById(
        bankAccountId,
      );

    if (!existingAccount) {
      const error = new Error(
        'Vendor bank account not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    await VendorsRepository.deleteBankAccount(
      bankAccountId,
    );

    return {
      message:
        'Vendor bank account deleted successfully.',
    };
  },

    // ------------------------------------------------------------
  // Vendor Fleet
  // ------------------------------------------------------------

  async getVendorCars(vendorId) {
    await this._ensureVendorExists(vendorId);

    const cars =
      await VendorsRepository.findCarsByVendorId(
        vendorId,
      );

    return cars.map((car) => ({
      id: car.id,
      registrationNumber: car.registrationNumber,
      brand: car.brand,
      model: car.model,
      variant: car.variant,
      manufacturingYear: car.manufacturingYear,
      fuelType: car.fuelType,
      transmission: car.transmission,
      seatingCapacity: car.seatingCapacity,
      status: car.status,
      branchId: car.branchId,
      primaryImage:
        car.images?.[0] || null,
      createdAt: car.createdAt,
      updatedAt: car.updatedAt,
    }));
  },

  // ------------------------------------------------------------
  // Vendor Bookings
  // ------------------------------------------------------------

  async getVendorBookings(vendorId, filters = {}) {
    await this._ensureVendorExists(vendorId);

    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      from,
      to,
    } = filters;

    const pageNumber =
      Math.max(Number(page) || 1, 1);

    const limitNumber =
      Math.min(
        Math.max(Number(limit) || 10, 1),
        100,
      );

    const where = {};

    // ----------------------------------------------------------
    // Booking Status
    // ----------------------------------------------------------

    if (status) {
      where.status = status;
    }

    // ----------------------------------------------------------
    // Payment Status
    // ----------------------------------------------------------

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    // ----------------------------------------------------------
    // Booking Date Range
    // ----------------------------------------------------------

    if (from || to) {
      where.createdAt = {};

      if (from) {
        where.createdAt.gte =
          new Date(from);
      }

      if (to) {
        const endDate = new Date(to);

        // If only a date was supplied, include the full day.
        if (
          typeof to === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(to)
        ) {
          endDate.setUTCHours(
            23,
            59,
            59,
            999,
          );
        }

        where.createdAt.lte =
          endDate;
      }
    }

    // ----------------------------------------------------------
    // Search
    // ----------------------------------------------------------

    if (search) {
      const value =
        String(search).trim();

      if (value) {
        where.OR = [
          {
            bookingNumber: {
              contains: value,
            },
          },
          {
            user: {
              is: {
                name: {
                  contains: value,
                },
              },
            },
          },
          {
            user: {
              is: {
                email: {
                  contains: value,
                },
              },
            },
          },
          {
            user: {
              is: {
                phone: {
                  contains: value,
                },
              },
            },
          },
          {
            car: {
              is: {
                registrationNumber: {
                  contains: value,
                },
              },
            },
          },
          {
            car: {
              is: {
                brand: {
                  contains: value,
                },
              },
            },
          },
          {
            car: {
              is: {
                model: {
                  contains: value,
                },
              },
            },
          },
        ];
      }
    }

    const skip =
      (pageNumber - 1) * limitNumber;

    const [bookings, total] =
      await Promise.all([
        VendorsRepository.findBookingsByVendorId({
          vendorId,
          where,
          skip,
          take: limitNumber,
        }),

        VendorsRepository.countBookingsByVendorId({
          vendorId,
          where,
        }),
      ]);

    const data = bookings.map(
      (booking) => {
        const latestPayment =
          booking.payments?.[0] || null;

        return {
          id: booking.id,
          bookingNumber:
            booking.bookingNumber,

          customer: booking.user
            ? {
                id: booking.user.id,
                name: booking.user.name,
                email: booking.user.email,
                phone: booking.user.phone,
              }
            : null,

          vehicle: booking.car
            ? {
                id: booking.car.id,
                registrationNumber:
                  booking.car
                    .registrationNumber,
                brand:
                  booking.car.brand,
                model:
                  booking.car.model,
                variant:
                  booking.car.variant,
                status:
                  booking.car.status,
              }
            : null,

          startAt: booking.startAt,
          endAt: booking.endAt,

          subtotal: booking.subtotal,
          tax: booking.tax,
          discount: booking.discount,
          securityDeposit:
            booking.securityDeposit,
          totalAmount:
            booking.totalAmount,
          currencyCode:
            booking.currencyCode,

          status: booking.status,
          paymentStatus:
            booking.paymentStatus,

          holdExpiresAt:
            booking.holdExpiresAt,
          cancelledAt:
            booking.cancelledAt,
          cancellationReason:
            booking.cancellationReason,

          latestPayment,

          createdAt:
            booking.createdAt,
          updatedAt:
            booking.updatedAt,
        };
      },
    );

    return {
      data,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages:
          Math.ceil(
            total / limitNumber,
          ),
      },
    };
  },

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  async _ensureVendorExists(vendorId) {
    const vendor =
      await VendorsRepository.findById(vendorId);

    if (!vendor || vendor.isDeleted) {
      const error = new Error(
        'Vendor not found.',
      );

      error.statusCode = 404;
      throw error;
    }

    return vendor;
  },

  _formatVendor(vendor) {
    return {
      id: vendor.id,
      vendorCode: vendor.vendorCode,
      companyName: vendor.companyName,
      legalName: vendor.legalName,
      email: vendor.email,
      phone: vendor.phone,
      website: vendor.website,
      taxId: vendor.taxId,
      gstin: vendor.gstin,
      verificationStatus:
        vendor.verificationStatus,
      commissionRate:
        vendor.commissionRate,
      status: vendor.status,
      isDeleted: vendor.isDeleted,
      deletedAt: vendor.deletedAt,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,

      documents:
        vendor.documents?.map(toVendorDocumentResponse),

      bankAccounts:
        vendor.bankAccounts || undefined,

      branches:
        vendor.branches || undefined,

      locations:
        vendor.locations || undefined,
    };
  },
};

VendorsService.toVendorDocumentResponse = toVendorDocumentResponse;

module.exports = VendorsService;
