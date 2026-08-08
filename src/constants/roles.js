'use strict';

/**
 * System role identifiers used in RBAC.
 * These map to roles managed in the database (rentcar-database).
 * Role → permission mappings are resolved through the database (RolePermission)
 * and the centralized authorization service. SUPER_ADMIN receives full system
 * access through a controlled authorization rule (not hardcoded email/user).
 */
module.exports = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  FLEET_MANAGER: 'FLEET_MANAGER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  SUPPORT_MANAGER: 'SUPPORT_MANAGER',
  VENDOR_MANAGER: 'VENDOR_MANAGER',
  ANALYST: 'ANALYST',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  VIEWER: 'VIEWER',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
};

/**
 * The default role assigned to newly registered users.
 */
const DEFAULT_ROLE = module.exports.CUSTOMER;
const DEFAULT_ROLE_NAME = 'CUSTOMER';

module.exports.DEFAULT_ROLE = DEFAULT_ROLE;
module.exports.DEFAULT_ROLE_NAME = DEFAULT_ROLE_NAME;
