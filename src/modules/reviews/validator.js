'use strict';

const { z } = require('zod');

const reviewStatus = z.enum([
  'pending',
  'approved',
  'rejected',
  'hidden',
]);

const reviewListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(255).optional(),
  status: reviewStatus.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(['createdAt', 'rating', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = {
  reviewStatus,
  reviewListSchema,
};
