'use strict';

/**
 * System role identifiers used in authorization.
 * These map to roles managed in the database (rentcar-database).
 */
module.exports = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  VENDOR: 'vendor',
  CUSTOMER: 'customer',
  SUPPORT: 'support',
  ACCOUNTANT: 'accountant',
};
