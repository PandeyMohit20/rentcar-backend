'use strict';

/**
 * Central registry of permission keys used for authorization.
 * Format: <module>.<action>
 * These are the canonical permission strings checked by authorize().
 */
module.exports = {
  // Users
  users_view: 'users.view',
  users_create: 'users.create',
  users_update: 'users.update',
  users_delete: 'users.delete',
  users_status_update: 'users.status.update',
  users_activate: 'users.activate',
  users_deactivate: 'users.deactivate',
  users_suspend: 'users.suspend',
  users_block: 'users.block',
  users_addresses_manage: 'users.addresses.manage',

  // Vendors
  vendors_view: 'vendors.view',
  vendors_create: 'vendors.create',
  vendors_update: 'vendors.update',
  vendors_delete: 'vendors.delete',

  // KYC review
  kyc_review: 'kyc.review',

  // Cars
  cars_view: 'cars.view',
  cars_create: 'cars.create',
  cars_update: 'cars.update',
  cars_delete: 'cars.delete',

  // Bookings
  bookings_view: 'bookings.view',
  bookings_create: 'bookings.create',
  bookings_update: 'bookings.update',
  bookings_cancel: 'bookings.cancel',
  bookings_operate: 'bookings.operate',

  // Payments
  payments_view: 'payments.view',
  payments_create: 'payments.create',
  payments_refund: 'payments.refund',

  // Wallet
  wallet_view: 'wallet.view',
  wallet_transact: 'wallet.transact',
  wallet_manage: 'wallet.manage',

  // Coupons
  coupons_view: 'coupons.view',
  coupons_create: 'coupons.create',
  coupons_update: 'coupons.update',
  coupons_delete: 'coupons.delete',

  // Reviews
  reviews_view: 'reviews.view',
  reviews_moderate: 'reviews.moderate',

  // Notifications
  notifications_view: 'notifications.view',
  notifications_send: 'notifications.send',

  // Support
  support_view: 'support.view',
  support_manage: 'support.manage',

  // Reports
  reports_view: 'reports.view',
  reports_generate: 'reports.generate',

  // Analytics
  analytics_view: 'analytics.view',

  // Admin
  admin_all: 'admin.all',

  // Settings
  settings_view: 'settings.view',
  settings_manage: 'settings.manage',
};
