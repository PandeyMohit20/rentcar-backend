'use strict';

const { z } = require('zod');

const transactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

module.exports = {
  transactionsQuerySchema,
};
