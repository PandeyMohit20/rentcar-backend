'use strict';

const crypto = require('crypto');
const { env } = require('../../config/env');

/**
 * Auth utilities — token hashing, OTP generation, safe user serialization,
 * and cookie helpers. Never returns raw secrets to callers unless explicitly
 * required (e.g. the raw refresh token / OTP for delivery).
 */

/**
 * SHA-256 hash of an arbitrary string (used for refresh tokens, session
 * tokens, OTP codes, reset/verification tokens). Only the hash is persisted.
 */
function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Generate a cryptographically secure random token (hex). */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Generate a numeric OTP of `length` digits. */
function generateOtp(length = 6) {
  const max = Math.pow(10, length);
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, '0');
}

/** Compute the SHA-256 hash of an OTP (only the hash is stored). */
function hashOtp(otp) {
  return hashSecret(otp);
}

/** Convert a duration string like "7d"/"15m"/"1h" to milliseconds. */
function durationToMs(duration) {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(String(duration).trim());
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * multipliers[unit];
}

/**
 * Build the cookie options for refresh token delivery.
 * Secure in production, configurable SameSite, optional domain.
 */
function cookieOptions({ maxAgeMs } = {}) {
  const options = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  };
  if (env.COOKIE_DOMAIN) options.domain = env.COOKIE_DOMAIN;
  if (maxAgeMs) options.maxAge = maxAgeMs;
  return options;
}

/**
 * Serialize a user for safe API responses.
 * Never returns passwordHash, OTP, refresh token hash, or internal fields.
 */
function serializeUser(user, { roles = [], permissions = [], profile = null } = {}) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
    roles,
    permissions,
    profile: profile
      ? {
          verificationStatus: profile.verificationStatus || null,
          dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
          gender: profile.gender || null,
          bio: profile.bio || null,
        }
      : null,
  };
}

module.exports = {
  hashSecret,
  randomToken,
  generateOtp,
  hashOtp,
  durationToMs,
  cookieOptions,
  serializeUser,
};
