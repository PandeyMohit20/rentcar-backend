'use strict';

const { Router } = require('express');
const fs = require('fs');
const { authenticate } = require('../../middlewares/authenticate');
const { validate } = require('../../middlewares/validate');
const { userKycDocumentUpload } = require('../../middlewares/upload');
const { KycController } = require('./controller');
const schemas = require('./validator');

const router = Router();
function validateUpload(req, res, next) {
  const result = schemas.upload.safeParse(req.body);
  if (result.success) { req.body = result.data; return next(); }
  if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  const error = new Error('Validation failed.'); error.name = 'ZodError'; error.issues = result.error.issues; error.statusCode = 422;
  return next(error);
}
router.post('/documents', authenticate, userKycDocumentUpload.single('file'), validateUpload, KycController.upload);
router.get('/documents', authenticate, validate({ query: schemas.list }), KycController.list);
router.get('/documents/:documentId/download', authenticate, validate({ params: schemas.documentId }), KycController.download);
router.get('/documents/:documentId', authenticate, validate({ params: schemas.documentId }), KycController.get);
router.delete('/documents/:documentId', authenticate, validate({ params: schemas.documentId }), KycController.remove);
router.post('/submit', authenticate, KycController.submit);
router.get('/status', authenticate, KycController.status);
module.exports = { kycRouter: router };
