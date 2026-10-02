'use strict';

const { z } = require('zod');

const transferCreateSchema = z
  .object({
    vehicleId: z.string().uuid(),
    toBranchId: z.string().uuid(),
    transferDate: z.string().date(),
    reason: z.string().trim().min(1).max(255).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .strict();

const transferListSchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    fromBranchId: z.string().uuid().optional(),
    toBranchId: z.string().uuid().optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.fromDate ||
      !value.toDate ||
      value.toDate >= value.fromDate,
    {
      message: 'toDate must be on or after fromDate.',
      path: ['toDate'],
    },
  );

const transferIdSchema = z.object({
  id: z.string().uuid(),
});

const transferVehicleHistorySchema = z.object({
  vehicleId: z.string().uuid(),
});

module.exports = {
  transferCreateSchema,
  transferListSchema,
  transferIdSchema,
  transferVehicleHistorySchema,
};
