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

      verificationStatus:
        data.verificationStatus ?? 'pending',

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
      'verificationStatus',
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

    return VendorsRepository.findDocumentsByVendorId(
      vendorId,
    );
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

    return VendorsRepository.createDocument({
      vendorId,
      documentType: data.documentType,
      documentUrl: data.documentUrl,
      status: data.status ?? 'pending',
      issuedAt: data.issuedAt ?? null,
      expiresAt: data.expiresAt ?? null,
      remarks: data.remarks ?? null,
    });
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

    return VendorsRepository.updateDocument(
      documentId,
      data,
    );
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

    if (data.isDefault) {
      await VendorsRepository.clearDefaultBankAccounts(
        vendorId,
      );
    }

    return VendorsRepository.createBankAccount({
      vendorId,
      accountHolder: data.accountHolder,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      ifscCode: data.ifscCode ?? null,
      swiftCode: data.swiftCode ?? null,
      currencyCode:
        data.currencyCode ?? 'INR',
      isDefault:
        data.isDefault ?? false,
      status:
        data.status ?? 'active',
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

    if (data.isDefault === true) {
      await VendorsRepository.clearDefaultBankAccounts(
        existingAccount.vendorId,
      );
    }

    return VendorsRepository.updateBankAccount(
      bankAccountId,
      
      data,
    );
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
        vendor.documents || undefined,

      bankAccounts:
        vendor.bankAccounts || undefined,

      branches:
        vendor.branches || undefined,

      locations:
        vendor.locations || undefined,
    };
  },
};

module.exports = VendorsService;