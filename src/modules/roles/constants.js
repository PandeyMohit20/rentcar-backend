'use strict';

/**
 * Roles module constants.
 */

const ROLE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

const ALLOWED_ROLE_STATUSES = Object.values(ROLE_STATUS);

const ROLE_SORT_FIELDS = [
  'name',
  'createdAt',
  'updatedAt',
  'status',
];

const MAX_LIMIT = 100;

const ROLE_PERMISSIONS = {
  VIEW: 'roles.view',
  CREATE: 'roles.create',
  UPDATE: 'roles.update',
  STATUS_UPDATE: 'roles.status.update',
  DELETE: 'roles.delete',
};

module.exports = {
  ROLE_STATUS,
  ALLOWED_ROLE_STATUSES,
  ROLE_SORT_FIELDS,
  MAX_LIMIT,
  ROLE_PERMISSIONS,
};