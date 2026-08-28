'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(
  process.cwd(),
  'uploads',
  'vendors',
);

// Create upload directory if it does not exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ============================================================
// STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_');

    cb(
      null,
      `${Date.now()}-${safeName}${ext}`,
    );
  },
});

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  console.log('========== VENDOR DOCUMENT UPLOAD ==========');

  console.log('File:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
  });

  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  const error = new Error(
    'Only PDF, JPG, JPEG, PNG, WEBP, DOC and DOCX files are allowed.',
  );

  error.statusCode = 400;

  return cb(error);
};

// ============================================================
// MULTER
// ============================================================

const vendorDocumentUpload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

module.exports = {
  vendorDocumentUpload,
};
