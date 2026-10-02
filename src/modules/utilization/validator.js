'use strict';

const { z } = require('zod');

const utilizationQuerySchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),

    vehicleId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),

    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate.',
    path: ['endDate'],
  });

module.exports = {
  utilizationQuerySchema,
};