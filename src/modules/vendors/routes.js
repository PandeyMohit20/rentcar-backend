'use strict';

const { Router } = require('express');

const controller = require('./controller');

const {
  vendorDocumentUpload,
} = require('../../middlewares/upload');

const router = Router();

// ============================================================
// VENDORS
// ============================================================

router.get(
  '/',
  controller.list,
);

router.post(
  '/',
  controller.create,
);

router.get(
  '/:vendorId',
  controller.getById,
);

router.patch(
  '/:vendorId',
  controller.update,
);

router.delete(
  '/:vendorId',
  controller.remove,
);

// ============================================================
// VENDOR STATUS
// ============================================================

router.patch(
  '/:vendorId/status',
  controller.updateStatus,
);

router.patch(
  '/:vendorId/verification-status',
  controller.updateVerificationStatus,
);

// ============================================================
// VENDOR DOCUMENTS
// ============================================================

// List vendor documents
router.get(
  '/:vendorId/documents',
  controller.listDocuments,
);

// Upload vendor document
router.post(
  '/:vendorId/documents',
  vendorDocumentUpload.single('file'),
  controller.createDocument,
);

// Get single document
router.get(
  '/documents/:documentId',
  controller.getDocument,
);

// Update document
router.patch(
  '/documents/:documentId',
  controller.updateDocument,
);

// Delete document
router.delete(
  '/documents/:documentId',
  controller.deleteDocument,
);

// ============================================================
// VENDOR BANK ACCOUNTS
// ============================================================

router.get(
  '/:vendorId/bank-accounts',
  controller.listBankAccounts,
);

router.post(
  '/:vendorId/bank-accounts',
  controller.createBankAccount,
);

router.get(
  '/bank-accounts/:bankAccountId',
  controller.getBankAccount,
);

router.patch(
  '/bank-accounts/:bankAccountId',
  controller.updateBankAccount,
);

router.delete(
  '/bank-accounts/:bankAccountId',
  controller.deleteBankAccount,
);

module.exports = {
  vendorsRouter: router,
};
