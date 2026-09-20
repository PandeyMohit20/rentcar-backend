'use strict';

const fs = require('fs');

const vendorService = require('./service');
const { AdminKycService } = require('../adminKyc/service');
const { removeUploadedFile, resolveVendorDocumentFile } = require('./documentStorage');

const {
  success,
  created,
} = require('../../utils/response');

const VendorsController = {

  // ============================================================
  // Vendor
  // ============================================================

  async create(req, res, next) {
    try {
      const vendor =
        await vendorService.createVendor(req.body);

      return created(res, {
        message: 'Vendor created successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result =
        await vendorService.listVendors(req.query);

      return success(res, {
        message: 'Vendors fetched successfully.',
        data: result.data,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const vendor =
        await vendorService.getVendorById(
          req.params.vendorId,
        );

      return success(res, {
        message: 'Vendor fetched successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const vendor =
        await vendorService.updateVendor(
          req.params.vendorId,
          req.body,
        );

      return success(res, {
        message: 'Vendor updated successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const result =
        await vendorService.deleteVendor(
          req.params.vendorId,
        );

      return success(res, {
        message: 'Vendor deleted successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================================
  // Vendor Status
  // ============================================================

  async updateStatus(req, res, next) {
    try {
      const vendor =
        await vendorService.updateStatus(
          req.params.vendorId,
          req.body.status,
        );

      return success(res, {
        message:
          'Vendor status updated successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateVerificationStatus(req, res, next) {
    try {
      const vendor = await AdminKycService.reviewVendor(
        req.user.sub,
        req.params.vendorId,
        req.body.verificationStatus === 'verified' ? 'verify' : 'reject',
        req.body.reason,
      );

      return success(res, {
        message:
          'Vendor verification status updated successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

    // ============================================================
  // Vendor Fleet
  // ============================================================

  async listCars(req, res, next) {
    try {
      const cars =
        await vendorService.getVendorCars(
          req.params.vendorId,
        );

      return success(res, {
        message:
          'Vendor vehicles fetched successfully.',
        data: cars,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================================
  // Vendor Bookings
  // ============================================================

  async listBookings(req, res, next) {
    try {
      const result =
        await vendorService.getVendorBookings(
          req.params.vendorId,
          req.query,
        );

      return success(res, {
        message:
          'Vendor bookings fetched successfully.',
        data: result.data,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================================
  // Vendor Documents
  // ============================================================

  async listDocuments(req, res, next) {
    try {
      const documents =
        await vendorService.listDocuments(
          req.params.vendorId,
        );

      return success(res, {
        message:
          'Vendor documents fetched successfully.',
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  },

  async createDocument(req, res, next) {
    try {
      const { vendorId } = req.params;

      // ----------------------------------------------------------
      // Validate uploaded file
      // ----------------------------------------------------------

      if (!req.file) {
        const error = new Error(
          'Document file is required. Field name must be "file".',
        );

        error.statusCode = 400;
        throw error;
      }

      // ----------------------------------------------------------
      // Generate document URL
      // ----------------------------------------------------------

      const documentUrl = `private/vendors/${req.file.filename}`;

      // ----------------------------------------------------------
      // Create database record
      // ----------------------------------------------------------

      const document =
        await vendorService.createDocument(
          vendorId,
          {
            documentType:
              req.body.documentType.trim(),

            documentUrl,

            issuedAt:
              req.body.issuedAt
                ? req.body.issuedAt
                : null,

            expiresAt:
              req.body.expiresAt
                ? req.body.expiresAt
                : null,

            remarks:
              req.body.remarks
                ? req.body.remarks.trim()
                : null,
          },
        );

      return created(res, {
        message:
          'Vendor document uploaded successfully.',
        data: document,
      });
    } catch (error) {
      removeUploadedFile(req.file);
      next(error);
    }
  },

  async getDocument(req, res, next) {
    try {
      const document =
        await vendorService.getDocument(
          req.params.documentId,
        );

      return success(res, {
        message:
          'Vendor document fetched successfully.',
        data: vendorService.toVendorDocumentResponse(document),
      });
    } catch (error) {
      next(error);
    }
  },

  async downloadDocument(req, res, next) {
    try {
      const document = req.vendorDocument || await vendorService.getDocument(req.params.documentId);
      const resolved = resolveVendorDocumentFile(document.documentUrl);
      if (!resolved || !fs.existsSync(resolved.filePath)) {
        const error = new Error('Vendor document file not found.');
        error.statusCode = 404;
        throw error;
      }
      return res.download(resolved.filePath, resolved.filename);
    } catch (error) {
      return next(error);
    }
  },
  async updateDocument(req, res, next) {
    try {
      const document =
        await vendorService.updateDocument(
          req.params.documentId,
          req.body,
        );

      return success(res, {
        message:
          'Vendor document updated successfully.',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteDocument(req, res, next) {
    try {
      const existingDocument = req.vendorDocument || await vendorService.getDocument(req.params.documentId);
      const result =
        await vendorService.deleteDocument(
          req.params.documentId,
        );

      const resolved = resolveVendorDocumentFile(existingDocument.documentUrl);
      if (resolved?.managed && fs.existsSync(resolved.filePath)) {
        try {
          fs.unlinkSync(resolved.filePath);
        } catch {
          // The database deletion remains authoritative; no storage reference is returned.
        }
      }

      return success(res, {
        message:
          'Vendor document deleted successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

// ------------------------------------------------------------
// Vendor Staff
// ------------------------------------------------------------

// ------------------------------------------------------------
// Vendor Settlements
// ------------------------------------------------------------

async listSettlements(req, res, next) {
  try {
    const result =
      await vendorService.getVendorSettlements(
        req.params.vendorId,
        req.query,
      );

    return success(res, {
      message:
        'Vendor settlements fetched successfully.',
      data: result.data,
      meta: result.pagination,
    });
  } catch (error) {
    next(error);
  }
},
async listStaff(req, res, next) {
  try {
    const staff =
      await vendorService.getVendorStaff(
        req.params.vendorId,
      );

    return success(res, {
      message:
        'Vendor staff fetched successfully.',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
},

// ------------------------------------------------------------
// Vendor Revenue
// ------------------------------------------------------------

async getRevenue(req, res, next) {
  try {
    const revenue =
      await vendorService.getVendorRevenue(
        req.params.vendorId,
      );

    return success(res, {
      message:
        'Vendor revenue fetched successfully.',
      data: revenue,
    });
  } catch (error) {
    next(error);
  }
},

// ------------------------------------------------------------
// Vendor Activity
// ------------------------------------------------------------

async listActivity(req, res, next) {
  try {
    const activity =
      await vendorService.getVendorActivity(
        req.params.vendorId,
      );

    return success(res, {
      message:
        'Vendor activity fetched successfully.',
      data: activity,
    });
  } catch (error) {
    next(error);
  }
},

// ------------------------------------------------------------
// Vendor Sessions
// ------------------------------------------------------------

async listSessions(req, res, next) {
  try {
    const sessions =
      await vendorService.getVendorSessions(
        req.params.vendorId,
      );

    return success(res, {
      message:
        'Vendor sessions fetched successfully.',
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
},

  // ============================================================
  // Vendor Bank Accounts
  // ============================================================

  async listBankAccounts(req, res, next) {
    try {
      const accounts =
        await vendorService.listBankAccounts(
          req.params.vendorId,
        );

      return success(res, {
        message:
          'Vendor bank accounts fetched successfully.',
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  },

  async createBankAccount(req, res, next) {
    try {
      const account =
        await vendorService.createBankAccount(
          req.params.vendorId,
          req.body,
        );

      return created(res, {
        message:
          'Vendor bank account created successfully.',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBankAccount(req, res, next) {
    try {
      const account =
        await vendorService.getBankAccount(
          req.params.bankAccountId,
        );

      return success(res, {
        message:
          'Vendor bank account fetched successfully.',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateBankAccount(req, res, next) {
    try {
      const account =
        await vendorService.updateBankAccount(
          req.params.bankAccountId,
          req.body,
        );

      return success(res, {
        message:
          'Vendor bank account updated successfully.',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteBankAccount(req, res, next) {
    try {
      const result =
        await vendorService.deleteBankAccount(
          req.params.bankAccountId,
        );

      return success(res, {
        message:
          'Vendor bank account deleted successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = VendorsController;
