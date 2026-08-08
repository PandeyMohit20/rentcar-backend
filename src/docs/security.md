# Security Documentation

## Overview

This document describes the security controls implemented in the RentCar backend
foundation and the rules that must be preserved going forward.

## JWT

- Access tokens are signed with `JWT_ACCESS_SECRET`.
- Refresh tokens are signed with `JWT_REFRESH_SECRET`.
- Secrets come exclusively from environment variables — **never hardcoded**.
- Tokens carry an issuer and audience claim to prevent cross-context reuse.
- `Authorization: Bearer <token>` is verified by `authenticate` middleware.

## Password Hashing

- Passwords are hashed with bcrypt (`SALT_ROUNDS = 10`).
- Plaintext passwords are **never** stored.
- Use `hashPassword()` / `comparePassword()` from `src/utils/password.js`.

## CORS

- CORS origins come from `CORS_ORIGIN` (comma-separated).
- Supports multiple origins (development, staging, production).
- `Access-Control-Allow-Origin: *` is **never** used when credentials are enabled.
- `credentials: true` requires explicit origins.

## Helmet

- Helmet sets secure HTTP headers (X-Content-Type-Options, X-Frame-Options,
  Strict-Transport-Security, etc.).
- Applied globally in `src/app.js`.

## Request Validation

- All request inputs are validated with Zod.
- Body, params, query, and headers can be validated via `validate` middleware.
- Invalid input returns `422 Unprocessable Entity`.

## Sensitive Data

Never log or return:

- Passwords / password hashes
- JWT tokens / OTP codes
- Bank account details / IFSC / card numbers
- Payment secrets / transaction PINs
- Authorization headers
- Database credentials / SQL queries

## Error Handling

- Global error handler returns safe JSON.
- Production responses **never** expose:
  - Stack traces
  - Database credentials
  - SQL queries
  - Internal filesystem paths
  - JWT secrets
  - Environment variables
- Prisma errors are mapped to sanitized HTTP responses (P2002 → 409, P2025 → 404,
  P2003 → 409).

## Logging

- Structured logging includes `requestId`, `method`, `path`, `statusCode`,
  `duration`, and `timestamp`.
- Sensitive fields are excluded from logs.
- `LOG_LEVEL` controls verbosity; use `silent` in tests.

## Secrets & Environment Variables

- `.env` is git-ignored and never committed.
- `.env.example` documents required variables with no real secrets.
- Required secrets validated at startup — the app fails fast if missing.
- Do not fall back to insecure defaults for secrets in production.

## Future Work

- Rate limiting (login, OTP, password reset, payment, public APIs).
- File upload validation and secure cloud storage (S3).
- Full RBAC permission resolution from the database.
