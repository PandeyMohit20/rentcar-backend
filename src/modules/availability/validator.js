'use strict';
const { z } = require('zod');
const statuses = ['available', 'unavailable', 'maintenance', 'blocked'];
const time = z.string().datetime({ offset: true });
const base = z.object({ date: z.string().date(), startTime: time.optional().nullable(), endTime: time.optional().nullable(), status: z.enum(statuses).optional(), reason: z.string().trim().min(1).max(255).optional().nullable() }).strict();
const range = (schema) => schema.refine((value) => !value.startTime || !value.endTime || new Date(value.endTime) > new Date(value.startTime), { message: 'endTime must be after startTime.', path: ['endTime'] });
module.exports = { availabilityId: z.object({ carId: z.string().uuid(), availabilityId: z.string().uuid() }), create: range(base), update: range(base.partial()), list: z.object({ page: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().positive().max(100).optional(), status: z.enum(statuses).optional(), fromDate: z.string().date().optional(), toDate: z.string().date().optional() }).refine((value) => !value.fromDate || !value.toDate || value.toDate >= value.fromDate, { message: 'toDate must be on or after fromDate.', path: ['toDate'] }) };
