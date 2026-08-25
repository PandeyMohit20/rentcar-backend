'use strict';

const { Router } = require('express');
const controller = require('./controller');

const router = Router();

// ------------------------------------------------------------
// Vendor
// ------------------------------------------------------------

router.get('/', controller.list);
router.post('/', controller.create);

router.get('/:vendorId', controller.getById);
router.patch('/:vendorId', controller.update);
router.delete('/:vendorId', controller.remove);

router.patch(
  '/:vendorId/status',
  controller.updateStatus,
);

router.patch(
  '/:vendorId/verification-status',
  controller.updateVerificationStatus,
);

// ------------------------------------------------------------
// Vendor Documents
// ------------------------------------------------------------

router.get(
  '/:vendorId/documents',
  controller.listDocuments,
);

router.post(
  '/:vendorId/documents',
  controller.createDocument,
);

router.get(
  '/documents/:documentId',
  controller.getDocument,
);

router.patch(
  '/documents/:documentId',
  controller.updateDocument,
);

router.delete(
  '/documents/:documentId',
  controller.deleteDocument,
);

// ------------------------------------------------------------
// Vendor Bank Accounts
// ------------------------------------------------------------

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

module.exports = { vendorsRouter: router };
