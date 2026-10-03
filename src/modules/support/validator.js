'use strict';

const { z } = require('zod');

const idParams = z.object({
  ticketId: z.string().uuid(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),

  search: z.string().trim().max(255).optional(),

  status: z.enum([
    'open',
    'pending',
    'resolved',
    'closed',
    'reopened',
  ]).optional(),

  priority: z.enum([
    'low',
    'medium',
    'high',
    'urgent',
  ]).optional(),

  category: z.enum([
    'booking',
    'payment',
    'refund',
    'support',
    'technical',
    'other',
  ]).optional(),

  assignedTo: z.string().uuid().optional(),

  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'priority',
    'status',
    'ticketNumber',
  ]).optional(),

  sortOrder: z.enum([
    'asc',
    'desc',
  ]).optional(),
});

const updateTicketBody = z.object({
  status: z.enum([
    'open',
    'pending',
    'resolved',
    'closed',
    'reopened',
  ]).optional(),

  priority: z.enum([
    'low',
    'medium',
    'high',
    'urgent',
  ]).optional(),

  category: z.enum([
    'booking',
    'payment',
    'refund',
    'support',
    'technical',
    'other',
  ]).optional(),

  assignedTo: z.string().uuid().nullable().optional(),
}).refine(
  (value) =>
    value.status !== undefined ||
    value.priority !== undefined ||
    value.category !== undefined ||
    value.assignedTo !== undefined,
  {
    message: 'At least one ticket field is required',
  },
);

const createMessageBody = z.object({
  message: z.string().trim().min(1).max(10000),
  attachmentUrl: z.string().trim().url().max(500).optional(),
});

module.exports = {
  idParams,
  listQuery,
  updateTicketBody,
  createMessageBody,
};
