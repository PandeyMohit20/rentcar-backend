'use strict';

const roles = require('../constants/roles');

/**
 * Centralized authorization service.
 * All role/permission checks are implemented here so business logic never
 * hardcodes emails or user IDs.
 *
 * Design decision (documented in src/docs/auth-security.md):
 * - Permission checks are the primary mechanism for application operations.
 * - Role checks are available for coarse-grained system-level branching.
 * - SUPPER_ADMIN (SUPER_ADMIN) is granted full system access through a
 *   controlled authorization rule below — NOT by hardcoding an email.
 *
 * The `req.user` object is expected to contain:
 *   {
 *     sub, sessionId,
 *     roles: ['CUSTOMER', ...],
 *     permissions: ['users.view', ...]
 *   }
 */

/**
 * Determine whether a role is the system super-admin (full access).
 * This is a controlled system-level rule, resolved via the role name.
 */
function isSuperAdmin(user) {
  return Boolean(user && Array.isArray(user.roles) && user.roles.includes(roles.SUPER_ADMIN));
}

/**
 * Return the effective permission set for a user.
 * SUPER_ADMIN resolves to the wildcard marker so downstream checks pass.
 */
function getUserPermissions(user) {
  if (!user) return [];
  if (isSuperAdmin(user)) return ['*'];
  return Array.isArray(user.permissions) ? user.permissions : [];
}

/** Check whether the user has a single specific permission. */
function hasPermission(user, permission) {
  const perms = getUserPermissions(user);
  return perms.includes('*') || perms.includes(permission);
}

/** Check whether the user has ANY of the given permissions. */
function hasAnyPermission(user, permissions) {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return list.some((perm) => hasPermission(user, perm));
}

/** Check whether the user has ALL of the given permissions. */
function hasAllPermissions(user, permissions) {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return list.every((perm) => hasPermission(user, perm));
}

/** Check whether the user has a specific role. */
function hasRole(user, role) {
  return Boolean(user && Array.isArray(user.roles) && user.roles.includes(role));
}

/** Check whether the user has ANY of the given roles. */
function hasAnyRole(user, rolesList) {
  const list = Array.isArray(rolesList) ? rolesList : [rolesList];
  return list.some((role) => hasRole(user, role));
}

module.exports = {
  isSuperAdmin,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
};
