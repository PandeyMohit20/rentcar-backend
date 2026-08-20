'use strict';

const { z } = require('zod');
const {
  ALLOWED_ROLE_STATUSES,
  ROLE_SORT_FIELDS,
  MAX_LIMIT,
} = require('./constants');

const roleIdParamSchema = z.object({
  roleId: z.string().uuid('Invalid role id.'),
});

const permissionSchema = z.object({
  module: z.string().trim().min(1).max(100),
  actions: z.array(z.string().trim().min(1).max(100)).min(1),
});

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  permissions: z.array(permissionSchema).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  permissions: z.array(permissionSchema).optional(),
});

const updateRoleStatusSchema = z.object({
  status: z.enum(ALLOWED_ROLE_STATUSES, {
    required_error: 'status is required.',
  }),
});

const listRolesSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(ALLOWED_ROLE_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).optional(),
  sortBy: z.enum(ROLE_SORT_FIELDS).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = {
  roleIdParamSchema,
  createRoleSchema,
  updateRoleSchema,
  updateRoleStatusSchema,
  listRolesSchema,
};
