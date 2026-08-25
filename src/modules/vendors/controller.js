'use strict';

const vendorService = require('./service');
const {
  success,
  created,
} = require('../../utils/response');

const VendorsController = {
  // ------------------------------------------------------------
  // Create Vendor
  // ------------------------------------------------------------

  async create(req, res, next) {
    try {
      const vendor = await vendorService.createVendor(req.body);

      return created(res, {
        message: 'Vendor created successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // List Vendors
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // Get Vendor
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // Update Vendor
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // Delete Vendor
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // Update Status
  // ------------------------------------------------------------

  async updateStatus(req, res, next) {
    try {
      const vendor =
        await vendorService.updateStatus(
          req.params.vendorId,
          req.body.status,
        );

      return success(res, {
        message: 'Vendor status updated successfully.',
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Update Verification Status
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // Vendor Documents
  // ------------------------------------------------------------

  async listDocuments(req, res, next) {
    try {
      const documents =
        await vendorService.listDocuments(
          req.params.vendorId,
        );

      return success(res, {
        message: 'Vendor documents fetched successfully.',
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  },

  async createDocument(req, res, next) {
    try {
      const document =
        await vendorService.createDocument(
          req.params.vendorId,
          req.body,
        );

      return created(res, {
        message: 'Vendor document created successfully.',
        data: document,
      });
    } catch (error) {
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
        message: 'Vendor document fetched successfully.',
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
        message: 'Vendor document updated successfully.',
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
        message: 'Vendor document deleted successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // ------------------------------------------------------------
  // Vendor Bank Accounts
  // ------------------------------------------------------------

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