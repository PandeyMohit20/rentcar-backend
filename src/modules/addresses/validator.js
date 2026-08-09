'use strict';

const { z } = require('zod');

const idParamSchema = z.object({
  addressId: z.string().uuid('Invalid address id.'),
});

const coordinateSchema = z
  .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/, 'Must be a valid coordinate.')])
  .optional()
  .nullable();

const addressTypeEnum = z.enum(['home', 'work', 'billing', 'shipping', 'other']).optional();

const createAddressSchema = z.object({
  addressLine1: z.string().trim().min(1, 'Address line 1 is required.').max(255),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().min(1, 'City is required.').max(255),
  state: z.string().trim().max(255).optional().nullable(),
  country: z.string().trim().min(1, 'Country is required.').max(255),
  postalCode: z.string().trim().max(50).optional().nullable(),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
  addressType: addressTypeEnum,
  isDefault: z.boolean().optional(),
});

const updateAddressSchema = createAddressSchema.partial();

module.exports = {
  idParamSchema,
  createAddressSchema,
  updateAddressSchema,
};
