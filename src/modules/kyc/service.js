'use strict';

const fs = require('fs');
const path = require('path');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { prisma } = require('../../config/database');
const { userKycDocumentDir } = require('../../middlewares/upload');

const notFound = () => new AppError('KYC document not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
const conflict = (message) => new AppError(message, httpStatus.CONFLICT, errorCodes.CONFLICT);
const safe = (document) => ({ id: document.id, documentType: document.documentType, status: document.status, issuedAt: document.issuedAt, expiresAt: document.expiresAt, remarks: document.remarks, rejectionReason: document.status === 'rejected' ? document.rejectionReason : null, createdAt: document.createdAt, updatedAt: document.updatedAt });
const audit = (userId, action, entityId, metadata = {}) => prisma.auditLog.create({ data: { userId, action, module: 'kyc', entity: 'user_document', entityId, result: 'success', metadata: JSON.stringify(metadata) } });
function filePath(storageKey) { const file = path.resolve(userKycDocumentDir, path.basename(storageKey || '')); return file.startsWith(`${userKycDocumentDir}${path.sep}`) ? file : null; }

async function ownDocument(userId, documentId) { const document = await prisma.userDocument.findFirst({ where: { id: documentId, userId } }); if (!document) throw notFound(); return document; }
async function profile(userId) { const record = await prisma.profile.findUnique({ where: { userId } }); if (!record) throw new AppError('Profile not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND); return record; }

const KycService = {
  safe,
  async upload(userId, data, file) {
    if (!file) throw new AppError('Document file is required.', httpStatus.UNPROCESSABLE_ENTITY, errorCodes.VALIDATION_ERROR);
    try {
      const document = await prisma.userDocument.create({ data: { userId, documentType: data.documentType, storageKey: file.filename, status: 'pending', issuedAt: data.issuedAt ? new Date(data.issuedAt) : null, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null, remarks: data.remarks || null } });
      await audit(userId, 'kyc.customer.document_uploaded', document.id, { documentId: document.id, documentType: document.documentType });
      return safe(document);
    } catch (error) {
      const stored = filePath(file.filename); if (stored && fs.existsSync(stored)) fs.unlinkSync(stored);
      throw error;
    }
  },
  async list(userId, filter) { return (await prisma.userDocument.findMany({ where: { userId, ...filter }, orderBy: { createdAt: 'desc' } })).map(safe); },
  async get(userId, documentId) { return safe(await ownDocument(userId, documentId)); },
  async download(userId, documentId) { const document = await ownDocument(userId, documentId); const stored = filePath(document.storageKey); if (!stored || !fs.existsSync(stored)) throw notFound(); return { path: stored, filename: path.basename(stored) }; },
  async remove(userId, documentId) {
    const document = await ownDocument(userId, documentId); const currentProfile = await profile(userId);
    if (document.status !== 'pending' || currentProfile.verificationStatus === 'verified') throw conflict('Only pending documents may be deleted.');
    await prisma.userDocument.delete({ where: { id: document.id } });
    const stored = filePath(document.storageKey); if (stored && fs.existsSync(stored)) fs.unlinkSync(stored);
    await audit(userId, 'kyc.customer.document_deleted', document.id, { documentId: document.id, documentType: document.documentType });
    return { success: true };
  },
  async submit(userId) {
    const current = await profile(userId); if (current.verificationStatus === 'verified') throw conflict('Verified KYC cannot be resubmitted by the customer.');
    const licence = await prisma.userDocument.findFirst({ where: { userId, documentType: 'driving_license', status: 'pending' }, orderBy: { createdAt: 'desc' } });
    if (!licence || !licence.expiresAt || new Date(licence.expiresAt) <= new Date()) throw new AppError('A current pending driving licence is required for KYC submission.', httpStatus.UNPROCESSABLE_ENTITY, errorCodes.VALIDATION_ERROR);
    const now = new Date(); const next = await prisma.profile.update({ where: { userId }, data: { verificationStatus: 'pending', submittedAt: current.submittedAt || now, rejectionReason: null } });
    await audit(userId, current.verificationStatus === 'rejected' ? 'kyc.customer.resubmitted' : 'kyc.customer.submitted', userId, { oldStatus: current.verificationStatus || 'unverified', newStatus: 'pending' });
    return { verificationStatus: next.verificationStatus, submittedAt: next.submittedAt, verifiedAt: next.verifiedAt || null, rejectionReason: next.verificationStatus === 'rejected' ? next.rejectionReason : null };
  },
  async status(userId) { const current = await profile(userId); const documents = await prisma.userDocument.findMany({ where: { userId } }); return { verificationStatus: current.verificationStatus || 'unverified', submittedAt: current.submittedAt || null, verifiedAt: current.verifiedAt || null, rejectionReason: current.verificationStatus === 'rejected' ? current.rejectionReason : null, documentCount: documents.length }; },
};

module.exports = { KycService };
