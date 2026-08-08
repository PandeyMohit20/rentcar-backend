'use strict';

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/**
 * JWT utilities for access and refresh tokens.
 * Secrets come exclusively from the environment — never hardcoded.
 */

const ACCESS_ISSUER = 'rentcar-api';
const REFRESH_ISSUER = 'rentcar-refresh';
const AUDIENCE = 'rentcar-clients';

function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    audience: AUDIENCE,
    issuer: ACCESS_ISSUER,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    audience: AUDIENCE,
    issuer: ACCESS_ISSUER,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    audience: AUDIENCE,
    issuer: REFRESH_ISSUER,
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    audience: AUDIENCE,
    issuer: REFRESH_ISSUER,
  });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
};
