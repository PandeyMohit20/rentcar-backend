'use strict';

const fs = require('fs');
const path = require('path');
const { vendorDocumentDir } = require('../../middlewares/upload');

const legacyVendorDocumentDir = path.resolve(process.cwd(), 'uploads', 'vendors');
const privateVendorDocumentDir = path.resolve(vendorDocumentDir);

function resolveWithin(root, filename) {
  if (!filename || filename !== path.basename(filename) || filename.includes('..')) return null;
  const filePath = path.resolve(root, filename);
  return filePath.startsWith(`${root}${path.sep}`) ? filePath : null;
}

function resolveVendorDocumentFile(reference) {
  if (typeof reference !== 'string') return null;
  if (reference.startsWith('private/vendors/')) {
    const filename = reference.slice('private/vendors/'.length);
    const filePath = resolveWithin(privateVendorDocumentDir, filename);
    return filePath ? { filePath, filename, managed: true } : null;
  }
  if (reference.startsWith('/uploads/vendors/')) {
    const filename = reference.slice('/uploads/vendors/'.length);
    const filePath = resolveWithin(legacyVendorDocumentDir, filename);
    return filePath ? { filePath, filename, managed: true } : null;
  }
  return null;
}

function removeUploadedFile(file) {
  if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
}

module.exports = { resolveVendorDocumentFile, removeUploadedFile, legacyVendorDocumentDir, privateVendorDocumentDir };
