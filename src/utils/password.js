'use strict';

const bcrypt = require('bcrypt');

/**
 * Password hashing utilities using bcrypt.
 * Plaintext passwords are never stored.
 */

const SALT_ROUNDS = 10;

/** Hash a plaintext password. */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/** Compare a plaintext password against a stored hash. */
async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, comparePassword, SALT_ROUNDS };
