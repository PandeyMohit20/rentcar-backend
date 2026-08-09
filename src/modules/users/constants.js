'use strict';

/**
 * Users module constants.
 */

/**
 * Account statuses supported by the database (UserStatusEnum, lowercase).
 * Only ACTIVE users can authenticate normally.
 */
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
  DELETED: 'deleted',
};

/** All statuses a client/admin may request when setting a status. */
const ALLOWED_STATUSES = Object.values(USER_STATUS);

/**
 * Valid status transitions (source -> set of allowed destinations).
 * Centralized here so account-status changes are never arbitrary.
 */
const STATUS_TRANSITIONS = {
  [USER_STATUS.ACTIVE]: [USER_STATUS.INACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.BLOCKED],
  [USER_STATUS.INACTIVE]: [USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.BLOCKED],
  [USER_STATUS.SUSPENDED]: [USER_STATUS.ACTIVE, USER_STATUS.BLOCKED],
  [USER_STATUS.BLOCKED]: [USER_STATUS.ACTIVE],
  [USER_STATUS.PENDING]: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.BLOCKED],
  [USER_STATUS.DELETED]: [],
};

/** Security event names (audit logging). */
const USER_EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_STATUS_CHANGED: 'user.status_changed',
  USER_ACTIVATED: 'user.activated',
  USER_DEACTIVATED: 'user.deactivated',
  USER_SUSPENDED: 'user.suspended',
  USER_BLOCKED: 'user.blocked',
  USER_DELETED: 'user.deleted',
  PROFILE_UPDATED: 'user.profile_updated',
  ADDRESS_CREATED: 'user.address_created',
  ADDRESS_UPDATED: 'user.address_updated',
  ADDRESS_DELETED: 'user.address_deleted',
  DEFAULT_ADDRESS_CHANGED: 'user.default_address_changed',
  EMAIL_CHANGED: 'user.email_changed',
  PHONE_CHANGED: 'user.phone_changed',
  PREFERENCES_UPDATED: 'user.preferences_updated',
};

/** Fields a user may update on their own account. */
const SELF_UPDATABLE_FIELDS = ['name', 'phone', 'dateOfBirth', 'gender'];

/** Fields an admin may update on a user account. */
const ADMIN_UPDATABLE_FIELDS = ['name', 'phone', 'dateOfBirth', 'gender', 'status'];

/** Whitelisted sort fields for the user list. */
const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'email', 'status', 'lastLoginAt'];

/** Max pagination limit (matches shared pagination util). */
const MAX_LIMIT = 100;

module.exports = {
  USER_STATUS,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
  USER_EVENTS,
  SELF_UPDATABLE_FIELDS,
  ADMIN_UPDATABLE_FIELDS,
  USER_SORT_FIELDS,
  MAX_LIMIT,
};
