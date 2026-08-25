'use strict';

/**
 * Vendor module constants.
 */

const VENDOR_SORT_FIELDS = Object.freeze([
  'createdAt',
  'updatedAt',
  'companyName',
  'vendorCode',
  'status',
  'verificationStatus',
]);

const VENDOR_SORT_ORDERS = Object.freeze([
  'asc',
  'desc',
]);

const VENDOR_DEFAULT_PAGE = 1;
const VENDOR_DEFAULT_PAGE_SIZE = 10;
const VENDOR_MAX_PAGE_SIZE = 100;

const VENDOR_DEFAULT_SORT_BY = 'createdAt';
const VENDOR_DEFAULT_SORT_ORDER = 'desc';

const VENDOR_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
  REJECTED: 'rejected',
});

const VENDOR_VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

module.exports = {
  VENDOR_SORT_FIELDS,
  VENDOR_SORT_ORDERS,
  VENDOR_DEFAULT_PAGE,
  VENDOR_DEFAULT_PAGE_SIZE,
  VENDOR_MAX_PAGE_SIZE,
  VENDOR_DEFAULT_SORT_BY,
  VENDOR_DEFAULT_SORT_ORDER,
  VENDOR_STATUS,
  VENDOR_VERIFICATION_STATUS,
};
