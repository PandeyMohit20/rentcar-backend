'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');

const controller = require('./controller');

const {
  vendorDocumentUpload,
} = require('../../middlewares/upload');
const {
  idParamSchema,
  documentIdParamSchema,
  bankAccountIdParamSchema,
  listVendorsSchema,
  createVendorSchema,
  updateVendorSchema,
  updateStatusSchema,
  updateVerificationStatusSchema,
  documentMetadataSchema,
  updateDocumentSchema,
  bankAccountSchema,
} = require('./validator');

const router = Router();

// ============================================================
// VENDORS
// ============================================================

router.get(
  '/',
  authenticate,
  authorize('vendors.view'),
  validate({ query: listVendorsSchema }),
  controller.list,
);

router.post(
  '/',
  authenticate,
  authorize('vendors.create'),
  validate({ body: createVendorSchema }),
  controller.create,
);

router.get(
  '/:vendorId',
  authenticate,
  authorize('vendors.view'),
  validate({ params: idParamSchema }),
  controller.getById,
);

router.patch(
  '/:vendorId',
  authenticate,
  authorize('vendors.update'),
  validate({ params: idParamSchema, body: updateVendorSchema }),
  controller.update,
);

router.delete(
  '/:vendorId',
  authenticate,
  authorize('vendors.delete'),
  validate({ params: idParamSchema }),
  controller.remove,
);

// ============================================================
// VENDOR STATUS
// ============================================================

router.patch(
  '/:vendorId/status',
  authenticate,
  authorize('vendors.update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  controller.updateStatus,
);

router.patch(
  '/:vendorId/verification-status',
  authenticate,
  authorize('vendors.update'),
  validate({ params: idParamSchema, body: updateVerificationStatusSchema }),
  controller.updateVerificationStatus,
);

// ============================================================
// VENDOR DOCUMENTS
// ============================================================

// List vendor documents
router.get(
  '/:vendorId/documents',
  authenticate,
  authorize('vendors.view'),
  validate({ params: idParamSchema }),
  controller.listDocuments,
);

// Upload vendor document
router.post(
  '/:vendorId/documents',
  authenticate,
  authorize('vendors.update'),
  validate({ params: idParamSchema }),
  vendorDocumentUpload.single('file'),
  validate({ body: documentMetadataSchema }),
  controller.createDocument,
);

router.get(
  '/documents/:documentId/download',
  authenticate,
  authorize('vendors.view'),
  validate({ params: documentIdParamSchema }),
  controller.downloadDocument,
);

// Get single document
router.get(
  '/documents/:documentId',
  authenticate,
  authorize('vendors.view'),
  validate({ params: documentIdParamSchema }),
  controller.getDocument,
);

// Update document
router.patch(
  '/documents/:documentId',
  authenticate,
  authorize('vendors.update'),
  validate({ params: documentIdParamSchema, body: updateDocumentSchema }),
  controller.updateDocument,
);

// Delete document
router.delete(
  '/documents/:documentId',
  authenticate,
  authorize('vendors.delete'),
  validate({ params: documentIdParamSchema }),
  controller.deleteDocument,
);

// ============================================================
// VENDOR BANK ACCOUNTS
// ============================================================

router.get(
  '/:vendorId/bank-accounts',
  authenticate,
  authorize('vendors.view'),
  validate({ params: idParamSchema }),
  controller.listBankAccounts,
);

router.post(
  '/:vendorId/bank-accounts',
  authenticate,
  authorize('vendors.update'),
  validate({ params: idParamSchema, body: bankAccountSchema }),
  controller.createBankAccount,
);

router.get(
  '/bank-accounts/:bankAccountId',
  authenticate,
  authorize('vendors.view'),
  validate({ params: bankAccountIdParamSchema }),
  controller.getBankAccount,
);

router.patch(
  '/bank-accounts/:bankAccountId',
  authenticate,
  authorize('vendors.update'),
  validate({ params: bankAccountIdParamSchema, body: bankAccountSchema.partial() }),
  controller.updateBankAccount,
);

router.delete(
  '/bank-accounts/:bankAccountId',
  authenticate,
  authorize('vendors.delete'),
  validate({ params: bankAccountIdParamSchema }),
  controller.deleteBankAccount,
);

module.exports = {
  vendorsRouter: router,
};
