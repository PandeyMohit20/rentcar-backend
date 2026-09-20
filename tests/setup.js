'use strict';

/**
 * Jest setup file.
 * Ensures test-safe environment variables are set BEFORE modules load.
 * Tests use an in-memory mocked database and never touch a real/production DB.
 */

process.env.NODE_ENV = 'test';

// Tests must fail closed by default.
// Individual UAT-bypass tests explicitly opt in when required.
process.env.BYPASS_TAX_APPROVAL_FOR_UAT = 'false';
process.env.PORT = '5100';
process.env.API_PREFIX = '/api/v1';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'mysql://test:test@localhost:3306/rentcar_test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_0123456789';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_0123456789';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.TEST_DATABASE_MOCK = 'true';
process.env.QUOTE_TTL_MINUTES = '10';
process.env.QUOTE_SIGNING_SECRET = 'test_quote_signing_secret_0123456789';
process.env.BOOKING_HOLD_TTL_MINUTES = '15';
