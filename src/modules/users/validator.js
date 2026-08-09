'use strict';

const { z } = require('zod');
const { USER_STATUS, ALLOWED_STATUSES } = require('./constants');

/**
 * Input normalization helpers.
 */
const emailField = z.string().trim().toLowerCase().email('Invalid email address.').max(255);
const phoneField = z
  .string()
  .trim()
  .max(50)
  .regex(/^\+?[0-9\s\-()]*$/, 'Invalid phone number.')
  .optional()
  .nullable();
const nameField = z.string().trim().min(2, 'Name must be at least 2 characters.').max(255);

const genderEnum = z.enum(['male', 'female', 'other', 'undisclosed']).optional().nullable();

/** Generic ID param schema (UUID). */
const idParamSchema = z.object({
  userId: z.string().uuid('Invalid user id.'),
});

/** Admin user-list query filters. */
const listUsersSchema = z.object({
  search: z.string().trim().max(255).optional(),
  email: emailField.optional(),
  phone: phoneField.optional(),
  status: z.enum(ALLOWED_STATUSES).optional(),
  role: z.string().trim().max(100).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/** Self update — only safe self-service fields. */
const updateSelfSchema = z.object({
  name: nameField.optional(),
  phone: phoneField,
  email: emailField.optional(),
});

/** Admin update — only approved admin-editable fields. */
const updateUserSchema = z.object({
  name: nameField.optional(),
  phone: phoneField,
  dateOfBirth: z.string().optional().nullable(),
  gender: genderEnum,
  status: z.enum(ALLOWED_STATUSES).optional(),
});

/** Profile update. */
const updateProfileSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD.')
    .optional()
    .nullable(),
  gender: genderEnum,
  bio: z.string().trim().max(1000).optional().nullable(),
});

/** Status update. */
const updateStatusSchema = z.object({
  status: z.enum(ALLOWED_STATUSES, { required_error: 'status is required.' }),
  reason: z.string().trim().max(500).optional(),
});

/** Suspend may optionally carry a reason. */
const suspendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

module.exports = {
  idParamSchema,
  listUsersSchema,
  updateSelfSchema,
  updateUserSchema,
  updateProfileSchema,
  updateStatusSchema,
  suspendSchema,
  USER_STATUS,
};
