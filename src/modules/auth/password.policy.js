'use strict';

/**
 * Centralized password policy.
 * Single source of truth for password requirements. Both the Zod validator
 * and the auth service read from here so requirements are never duplicated.
 */
const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
};

const SPECIAL_CHARS = "!@#$%^&*(),.?\":{}|<>_\\-+=\\[\\];/'`~";
const SPECIAL_CHAR_REGEX = new RegExp(`[${SPECIAL_CHARS}]`);

/**
 * Validate a password against the policy.
 * Returns { valid: boolean, errors: string[] }.
 */
function validatePassword(password) {
  const errors = [];
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, errors: ['Password is required.'] };
  }

  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long.`);
  }
  if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_POLICY.MAX_LENGTH} characters long.`);
  }
  if (PASSWORD_POLICY.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (PASSWORD_POLICY.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (PASSWORD_POLICY.REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number.');
  }
  if (PASSWORD_POLICY.REQUIRE_SPECIAL && !SPECIAL_CHAR_REGEX.test(password)) {
    errors.push('Password must contain at least one special character.');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { PASSWORD_POLICY, validatePassword };
