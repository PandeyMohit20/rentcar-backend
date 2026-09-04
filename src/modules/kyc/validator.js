'use strict';

const { z } = require('zod');

const documentTypes = ['driving_license', 'pan', 'identity_proof', 'address_proof'];
const documentId = z.object({ documentId: z.string().uuid() });
const upload = z.object({
  documentType: z.enum(documentTypes),
  issuedAt: z.string().date().optional(),
  expiresAt: z.string().date().optional(),
  remarks: z.string().trim().max(500).optional(),
}).refine((data) => !data.issuedAt || !data.expiresAt || data.issuedAt <= data.expiresAt, { message: 'expiresAt must be after issuedAt.', path: ['expiresAt'] })
  .refine((data) => data.documentType !== 'driving_license' || Boolean(data.expiresAt), { message: 'expiresAt is required for driving_license.', path: ['expiresAt'] });
const list = z.object({ documentType: z.enum(documentTypes).optional(), status: z.enum(['pending', 'verified', 'rejected', 'expired']).optional() });

module.exports = { documentId, upload, list };
