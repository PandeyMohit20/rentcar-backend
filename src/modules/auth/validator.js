'use strict';

const { z } = require('zod');

/**
 * Auth validation schemas (Zod).
 * Phase 19 foundation only. Extended in Phase 20.
 */
const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
