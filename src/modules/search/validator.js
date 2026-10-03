'use strict';

const { z } = require('zod');

const searchQuery = z.object({
  q: z.string().trim().max(100).optional().default(''),
});

module.exports = { searchQuery };
