'use strict';

/**
 * Auth module constants.
 */

const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
};

const COOKIE_NAMES = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
};

/**
 * Account statuses supported by the database (UserStatusEnum).
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

/**
 * OTP purposes — controlled enum/constants.
 * Clients must not supply arbitrary purposes; these are the only allowed values.
 * These map to the database OtpPurposeEnum values (lowercase).
 */
const OTP_PURPOSE = {
  REGISTRATION: 'registration',
  LOGIN: 'login',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  PHONE_VERIFICATION: 'phone_verification',
  DELETE_ACCOUNT: 'delete_account',
};

/** Allowed OTP purposes for client-facing endpoints (send-otp/verify-otp). */
const CLIENT_OTP_PURPOSES = [
  OTP_PURPOSE.LOGIN,
  OTP_PURPOSE.PHONE_VERIFICATION,
  OTP_PURPOSE.EMAIL_VERIFICATION,
  OTP_PURPOSE.PASSWORD_RESET,
];

/** Security event names (audit/activity logging). */
const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  REGISTER_SUCCESS: 'auth.register_success',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout_all',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET: 'auth.password_reset',
  EMAIL_VERIFIED: 'auth.email_verified',
  OTP_SENT: 'auth.otp_sent',
  OTP_VERIFIED: 'auth.otp_verified',
  OTP_FAILED: 'auth.otp_failed',
  REFRESH_TOKEN_ROTATED: 'auth.refresh_token_rotated',
  REFRESH_TOKEN_REUSE_DETECTED: 'auth.refresh_token_reuse_detected',
};

/** OTP constraints. */
const OTP_CONFIG = {
  LENGTH: 6,
  MAX_ATTEMPTS: 5,
  TTL_MS: 10 * 60 * 1000, // 10 minutes
};

/** Verification OTP / reset token TTLs. */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min

/** Session TTL (ms). Refresh tokens share this lifetime. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

module.exports = {
  TOKEN_TYPE,
  COOKIE_NAMES,
  USER_STATUS,
  OTP_PURPOSE,
  CLIENT_OTP_PURPOSES,
  AUTH_EVENTS,
  OTP_CONFIG,
  VERIFICATION_TTL_MS,
  RESET_TOKEN_TTL_MS,
  SESSION_TTL_MS,
};
