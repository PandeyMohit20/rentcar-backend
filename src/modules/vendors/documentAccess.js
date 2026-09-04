'use strict';

const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');
const { hasPermission } = require('../../services/authorization.service');

function notFound() {
  return new AppError('Vendor document not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
}

async function isVendorMember(userId, vendorId) {
  if (!userId || !vendorId) return false;
  return Boolean(await prisma.vendorMember.findFirst({ where: { userId, vendorId } }));
}

async function assertVendorDocumentAccess(user, vendorId, permission) {
  // kyc.review includes the existing SUPER_ADMIN wildcard path through hasPermission.
  if (hasPermission(user, 'kyc.review')) return;
  if (!await isVendorMember(user?.sub, vendorId)) throw notFound();
  if (!hasPermission(user, permission)) {
    throw new AppError('Insufficient permissions to perform this action.', httpStatus.FORBIDDEN, errorCodes.AUTH_FORBIDDEN);
  }
}

function vendorDocumentScope(permission) {
  return async (req, res, next) => {
    try {
      const document = await prisma.vendorDocument.findUnique({ where: { id: req.params.documentId } });
      if (!document) throw notFound();
      await assertVendorDocumentAccess(req.user, document.vendorId, permission);
      req.vendorDocument = document;
      return next();
    } catch (error) { return next(error); }
  };
}

function vendorScope(permission) {
  return async (req, res, next) => {
    try {
      await assertVendorDocumentAccess(req.user, req.params.vendorId, permission);
      return next();
    } catch (error) { return next(error); }
  };
}

module.exports = { isVendorMember, vendorDocumentScope, vendorScope };
