'use strict';

const { z } = require('zod');

/**
 * Profile validation schemas.
 * Only existing Profile fields are editable (dateOfBirth, gender, bio, profileImage).
 * profileImage is a reference to a stored file; actual upload/storage is out of
 * scope for Phase 21 (see src/docs/users-api.md).
 */

const genderEnum = z.enum(['male', 'female', 'other', 'undisclosed']).optional().nullable();

const updateProfileSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD.')
    .optional()
    .nullable(),
  gender: genderEnum,
  bio: z.string().trim().max(1000).optional().nullable(),
  profileImage: z.string().trim().max(500).optional().nullable(),
});

module.exports = { updateProfileSchema };
