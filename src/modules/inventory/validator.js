'use strict';

const { z } = require('zod');

const CAR_STATUSES = ['available', 'booked', 'busy', 'maintenance', 'inactive', 'retired'];

const BLACKOUT_TYPES = [
  'holiday',
  'maintenance',
  'private_event',
  'operational_block',
  'other',
];

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

const blackoutCreateSchema = z
  .object({
    vehicleId: z.string().uuid(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    type: z.enum(BLACKOUT_TYPES),
    reason: z.string().trim().min(1).max(255),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate.',
    path: ['endDate'],
  });

const blackoutUpdateSchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    type: z.enum(BLACKOUT_TYPES).optional(),
    reason: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      value.endDate >= value.startDate,
    {
      message: 'endDate must be on or after startDate.',
      path: ['endDate'],
    },
  );

const blackoutListSchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    type: z.enum(BLACKOUT_TYPES).optional(),
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

const blackoutIdSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  CAR_STATUSES,
  BLACKOUT_TYPES,
  inventoryQuerySchema,
  calendarQuerySchema,
  blackoutCreateSchema,
  blackoutUpdateSchema,
  blackoutListSchema,
  blackoutIdSchema,
};
