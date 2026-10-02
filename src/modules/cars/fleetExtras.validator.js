'use strict';

const { z } = require('zod');

const insuranceStatus = ['pending', 'verified', 'rejected', 'expired'];

const maintenanceStatus = ['active', 'inactive', 'pending', 'suspended', 'archived', 'rejected'];

const carId = z.object({
  carId: z.string().uuid(),
});

const insuranceId = z.object({
  carId: z.string().uuid(),
  insuranceId: z.string().uuid(),
});

const insuranceFields = {
  provider: z.string().trim().min(1).max(255),
  policyNumber: z.string().trim().min(1).max(150),
  coverageType: z.string().trim().max(100).optional().nullable(),
  startDate: z.string().date().optional().nullable(),
  expiryDate: z.string().date().optional().nullable(),
  documentUrl: z.string().trim().max(500).optional().nullable(),
  status: z.enum(insuranceStatus).optional(),
};

const insuranceCreate = z
  .object(insuranceFields)
  .refine((value) => !value.startDate || !value.expiryDate || value.startDate <= value.expiryDate, {
    message: 'expiryDate must be after startDate',
    path: ['expiryDate'],
  });

const insuranceUpdate = z
  .object(insuranceFields)
  .partial()
  .refine((value) => !value.startDate || !value.expiryDate || value.startDate <= value.expiryDate, {
    message: 'expiryDate must be after startDate',
    path: ['expiryDate'],
  });

const maintenanceId = z.object({
  carId: z.string().uuid(),
  maintenanceId: z.string().uuid(),
});

const maintenanceBase = z.object({
  maintenanceType: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  currencyCode: z.string().trim().length(3).optional(),
  odometer: z.coerce.number().int().min(0).optional().nullable(),
  status: z.enum(maintenanceStatus).optional(),
});

module.exports = {
  carId,
  insuranceId,
  insuranceCreate,
  insuranceUpdate,
  maintenanceId,
  maintenanceCreate: maintenanceBase,
  maintenanceUpdate: maintenanceBase.partial(),
};
