'use strict';

const { z } = require('zod');
const {
  VENDOR_STATUS,
  VENDOR_VERIFICATION_STATUS,
} = require('./constants');

/**
 * Input normalization helpers.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address.')
  .max(255);

const phoneField = z
  .string()
  .trim()
  .max(50)
  .regex(/^\+?[0-9\s\-()]*$/, 'Invalid phone number.')
  .optional()
  .nullable();

const vendorCodeField = z
  .string()
  .trim()
  .min(2, 'Vendor code must be at least 2 characters.')
  .max(50);

const companyNameField = z
  .string()
  .trim()
  .min(2, 'Company name must be at least 2 characters.')
  .max(255);

const legalNameField = z
  .string()
  .trim()
  .min(2, 'Legal name must be at least 2 characters.')
  .max(255)
  .optional()
  .nullable();

const websiteField = z
  .string()
  .trim()
  .url('Invalid website URL.')
  .max(255)
  .optional()
  .nullable();

const taxIdField = z
  .string()
  .trim()
  .max(100)
  .optional()
  .nullable();

const gstinField = z
  .string()
  .trim()
  .toUpperCase()
  .max(100)
  .optional()
  .nullable();

const commissionRateField = z
  .coerce
  .number()
  .min(0, 'Commission rate cannot be negative.')
  .max(100, 'Commission rate cannot exceed 100.')
  .optional()
  .nullable();

/** Generic vendor ID param schema. */
const idParamSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor id.'),
});
const documentIdParamSchema = z.object({
  documentId: z.string().uuid('Invalid vendor document id.'),
});
const bankAccountIdParamSchema = z.object({
  bankAccountId: z.string().uuid('Invalid vendor bank account id.'),
});

/** Vendor list query filters. */
const listVendorsSchema = z.object({
  search: z.string().trim().max(255).optional(),
  vendorCode: z.string().trim().max(50).optional(),
  email: emailField.optional(),
  phone: phoneField,
  status: z.enum(Object.values(VENDOR_STATUS)).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/** Create vendor schema. */
const createVendorSchema = z.object({
  vendorCode: vendorCodeField,
  companyName: companyNameField,
  legalName: legalNameField,
  email: emailField.optional().nullable(),
  phone: phoneField,
  website: websiteField,
  taxId: taxIdField,
  gstin: gstinField,
  commissionRate: commissionRateField,
});

/** Update vendor schema. */
const updateVendorSchema = z.object({
  vendorCode: vendorCodeField.optional(),
  companyName: companyNameField.optional(),
  legalName: legalNameField,
  email: emailField.optional().nullable(),
  phone: phoneField,
  website: websiteField,
  taxId: taxIdField,
  gstin: gstinField,
  verificationStatus: z
    .enum(Object.values(VENDOR_VERIFICATION_STATUS))
    .optional(),
  commissionRate: commissionRateField,
});

/** Vendor status update schema. */
const updateStatusSchema = z.object({
  status: z.enum(Object.values(VENDOR_STATUS), {
    required_error: 'status is required.',
  }),
  reason: z.string().trim().max(500).optional(),
});

/** Vendor verification status update schema. */
const updateVerificationStatusSchema = z.object({
  verificationStatus: z.enum(['verified', 'rejected'], {
    required_error: 'verificationStatus is required.',
  }),
  reason: z.string().trim().max(500).optional(),
});

const documentMetadataSchema = z.object({
  documentType: z.string().trim().min(1).max(100),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
});

const updateDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(100).optional(),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
});

const bankAccountSchema = z.object({
  accountHolder: z.string().trim().min(2).max(255),
  bankName: z.string().trim().min(2).max(255),
  accountNumber: z.string().trim().min(4).max(100),
  ifscCode: z.string().trim().max(50).optional().nullable(),
  swiftCode: z.string().trim().max(50).optional().nullable(),
  currencyCode: z.string().trim().length(3).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(Object.values(VENDOR_STATUS)).optional(),
});

module.exports = {
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
  VENDOR_STATUS,
  VENDOR_VERIFICATION_STATUS,
};
