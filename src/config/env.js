'use strict';

const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

/**
 * Centralized environment configuration.
 * Loads and validates all required environment variables using Zod.
 * The application fails fast if required variables (especially secrets)
 * are missing or invalid. It never silently continues with undefined secrets.
 */

// Determine which env file to load based on NODE_ENV.
// Test uses .env.test, all others use .env.
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  // DATABASE_URL is required — the backend connects via Prisma Client.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT secrets — REQUIRED. Never fall back to defaults in production.
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),

  // Cookies
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  // Optional cookie domain. Leave empty in development/single-origin setups.
  COOKIE_DOMAIN: z.string().optional().default(''),
  QUOTE_TTL_MINUTES: z.coerce.number().int().positive().max(60).default(10),
  QUOTE_SIGNING_SECRET: z.string().min(16).default('development_quote_signing_secret_change_me'),
  BOOKING_HOLD_TTL_MINUTES: z.coerce.number().int().positive().max(120).default(15),
  PAYMENT_PROVIDER: z.enum(['razorpay']).default('razorpay'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  // Test-only flag
  TEST_DATABASE_MOCK: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast — do not boot with missing/invalid config.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  // Use console.error here because logger is not yet initialized.
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration. Application will not start.');
  // eslint-disable-next-line no-console
  console.error(issues.join('\n'));
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && !process.env.QUOTE_SIGNING_SECRET) {
  // eslint-disable-next-line no-console
  console.error('❌ QUOTE_SIGNING_SECRET must be explicitly configured in production.');
  process.exit(1);
}

const env = parsed.data;

module.exports = {
  env,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  isStaging: env.NODE_ENV === 'staging',
};
