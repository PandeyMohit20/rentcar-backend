'use strict';

const vendorService = require('./service');

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
      const vendor =
        await vendorService.updateVerificationStatus(
          req.params.vendorId,
          req.body.verificationStatus,
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

      console.log(
        '========== CREATE VENDOR DOCUMENT =========='
      );

      console.log('vendorId:', vendorId);
      console.log('body:', req.body);
      console.log('file:', req.file);

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
      // Validate document type
      // ----------------------------------------------------------

      if (
        !req.body.documentType ||
        !req.body.documentType.trim()
      ) {
        const error = new Error(
          'Document type is required.',
        );

        error.statusCode = 400;
        throw error;
      }

      // ----------------------------------------------------------
      // Generate document URL
      // ----------------------------------------------------------

      const documentUrl =
        `/uploads/vendors/${req.file.filename}`;

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

      console.log(
        'Created document:',
        document,
      );

      return created(res, {
        message:
          'Vendor document uploaded successfully.',
        data: document,
      });
    } catch (error) {
      console.error(
        'CREATE VENDOR DOCUMENT ERROR:',
        error,
      );

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
        data: document,
      });
    } catch (error) {
      next(error);
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
      const result =
        await vendorService.deleteDocument(
          req.params.documentId,
        );

      return success(res, {
        message:
          'Vendor document deleted successfully.',
        data: result,
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


