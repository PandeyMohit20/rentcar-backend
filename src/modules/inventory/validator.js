'use strict';

const { z } = require('zod');

const CAR_STATUSES = ['available', 'booked', 'busy', 'maintenance', 'inactive', 'retired'];

const inventoryQuerySchema = z
  .object({
    search: z.string().trim().max(150).optional(),

    vendorId: z.string().uuid().optional(),

    branchId: z.string().uuid().optional(),

    status: z.enum(CAR_STATUSES).optional(),
  })
  .strict();

const calendarQuerySchema = z
  .object({
    startDate: z.string().date(),

    endDate: z.string().date(),

    vendorId: z.string().uuid().optional(),

    branchId: z.string().uuid().optional(),

    carId: z.string().uuid().optional(),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate.',
    path: ['endDate'],
  });

module.exports = {
  CAR_STATUSES,
  inventoryQuerySchema,
  calendarQuerySchema,
};
