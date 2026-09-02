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

  const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx']);
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.has(extension)) {
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

const carImageDir = path.join(process.cwd(), 'uploads', 'cars');
if (!fs.existsSync(carImageDir)) fs.mkdirSync(carImageDir, { recursive: true });
const carImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, carImageDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    const error = new Error('Only JPG, PNG, and WEBP car images are allowed.'); error.statusCode = 400; return cb(error);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});
const carDocumentDir = path.join(process.cwd(), 'uploads', 'private', 'cars');
if (!fs.existsSync(carDocumentDir)) fs.mkdirSync(carDocumentDir, { recursive: true });
const carDocumentUpload = multer({ storage: multer.diskStorage({ destination: (_r,_f,cb)=>cb(null,carDocumentDir), filename: (_r,file,cb)=>cb(null,`${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`) }), fileFilter: (_r,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();if(['.pdf','.jpg','.jpeg','.png','.webp'].includes(ext)&&['application/pdf','image/jpeg','image/png','image/webp'].includes(file.mimetype))return cb(null,true);const e=new Error('Only PDF, JPG, PNG, and WEBP car documents are allowed.');e.statusCode=400;return cb(e);}, limits:{fileSize:10*1024*1024} });

module.exports = {
  vendorDocumentUpload,
  carImageUpload,
  carImageDir,
  carDocumentUpload,
  carDocumentDir,
};
