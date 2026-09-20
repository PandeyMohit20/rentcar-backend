'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { removeUploadedFile } = require('./documentStorage');
const { vendorDocumentScope, vendorScope } = require('./documentAccess');

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
  listSettlementsSchema,
} = require('./validator');

const router = Router();

function validateVendorDocumentMetadata(req, res, next) {
  const result = documentMetadataSchema.safeParse(req.body);
  if (result.success) {
    req.body = result.data;
    return next();
  }
  removeUploadedFile(req.file);
  const error = new Error('Validation failed.');
  error.name = 'ZodError';
  error.issues = result.error.issues;
  error.statusCode = 422;
  return next(error);
}

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

// ------------------------------------------------------------
// Vendor Staff
// ------------------------------------------------------------

router.get(
  '/:vendorId/staff',
  authenticate,
  authorize('vendors.view'),
  validate({
    params: idParamSchema,
  }),
  controller.listStaff,
);

// ------------------------------------------------------------
// Vendor Revenue
// ------------------------------------------------------------

router.get(
  '/:vendorId/revenue',
  authenticate,
  authorize('vendors.view'),
  validate({
    params: idParamSchema,
  }),
  controller.getRevenue,
);

// ------------------------------------------------------------
// Vendor Activity
// ------------------------------------------------------------

router.get(
  '/:vendorId/activity',
  authenticate,
  authorize('vendors.view'),
  validate({
    params: idParamSchema,
  }),
  controller.listActivity,
);

// ------------------------------------------------------------
// Vendor Sessions
// ------------------------------------------------------------

router.get(
  '/:vendorId/sessions',
  authenticate,
  authorize('vendors.view'),
  validate({
    params: idParamSchema,
  }),
  controller.listSessions,
);

// ------------------------------------------------------------
// Vendor Settlements
// ------------------------------------------------------------

router.get(
  '/:vendorId/settlements',
  authenticate,
  authorize('vendors.view'),
  validate({
    params: idParamSchema,
    query: listSettlementsSchema,
  }),
  controller.listSettlements,
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
  authorize('kyc.review'),
  validate({ params: idParamSchema, body: updateVerificationStatusSchema }),
  controller.updateVerificationStatus,
);

// ============================================================
// VENDOR FLEET
// ============================================================

router.get(
  '/:vendorId/cars',
  authenticate,
  authorize('vendors.view'),
  validate({ params: idParamSchema }),
  controller.listCars,
);

// ============================================================
// VENDOR BOOKINGS
// ============================================================

router.get(
  '/:vendorId/bookings',
  authenticate,
  authorize('vendors.view'),
  validate({ params: idParamSchema }),
  controller.listBookings,
);

// ============================================================
// VENDOR DOCUMENTS
// ============================================================

// List vendor documents
router.get(
  '/:vendorId/documents',
  authenticate,
  validate({ params: idParamSchema }),
  vendorScope('vendors.view'),
  controller.listDocuments,
);

// Upload vendor document
router.post(
  '/:vendorId/documents',
  authenticate,
  validate({ params: idParamSchema }),
  vendorScope('vendors.update'),
  vendorDocumentUpload.single('file'),
  validateVendorDocumentMetadata,
  controller.createDocument,
);

router.get(
  '/documents/:documentId/download',
  authenticate,
  validate({ params: documentIdParamSchema }),
  vendorDocumentScope('vendors.view'),
  controller.downloadDocument,
);

// Get single document
router.get(
  '/documents/:documentId',
  authenticate,
  validate({ params: documentIdParamSchema }),
  vendorDocumentScope('vendors.view'),
  controller.getDocument,
);

// Update document
router.patch(
  '/documents/:documentId',
  authenticate,
  validate({ params: documentIdParamSchema, body: updateDocumentSchema }),
  vendorDocumentScope('vendors.update'),
  controller.updateDocument,
);

// Delete document
router.delete(
  '/documents/:documentId',
  authenticate,
  validate({ params: documentIdParamSchema }),
  vendorDocumentScope('vendors.delete'),
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
