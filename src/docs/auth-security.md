# Auth Security Documentation

This document describes the security controls implemented in the Phase 20
authentication & authorization system.

## Password Hashing

- Passwords are hashed with bcrypt (`SALT_ROUNDS = 10`).
- Plaintext passwords are **never** stored, logged, or returned.
- Password updates create a new bcrypt hash.
- Password validation is centralized in `src/modules/auth/password.policy.js`
  (single source of truth). Never duplicate password rules elsewhere.

## JWT

- **Access tokens** are signed with `JWT_ACCESS_SECRET`, short-lived (`15m` default).
- **Refresh tokens** are signed with `JWT_REFRESH_SECRET`, long-lived (`7d` default).
- Tokens carry an issuer and audience claim to prevent cross-context reuse.
- Access token payload contains only minimum claims:
  `sub`, `role`, `sessionId`, `type`. No sensitive user data.
- Authorization uses `Authorization: Bearer <access_token>`.

## Refresh Token Rotation

- Only the **hash** of the refresh token is stored in the database
  (`RefreshToken.tokenHash`), never the raw token.
- Every refresh **revokes the old token** and **issues a new one** within a
  single Prisma transaction (atomic — prevents race conditions).
- Refresh token **reuse is detected**: if a token is presented but no matching
  stored hash exists (already rotated/revoked), the affected session is revoked
  and an `REFRESH_TOKEN_REUSE_DETECTED` audit event is recorded.
- Chosen policy: on detected reuse, **the affected session is revoked**. The
  account is not globally locked by default (documented decision).

## Token Storage & Cookies

- Refresh tokens are delivered via **HttpOnly, Secure (in production), SameSite**
  cookies. They are **never** stored in `localStorage`.
- Cookie settings come from environment variables:
  - `COOKIE_SECURE` (true in production)
  - `COOKIE_SAME_SITE` (lax/strict/none)
  - `COOKIE_DOMAIN` (optional configured domain)
- `src/modules/auth/auth.utils.js` centralizes cookie option generation.

## Session Management

- Each login creates a `Session` row keyed by a hashed session token.
- Sessions store `ipAddress`, `userAgent`, `expiresAt`, `lastActiveAt`,
  `revokedAt`.
- Protected operations validate the session is active and not revoked.
- Logout revokes the session; logout-all revokes all sessions + refresh tokens.

## OTP Security

- OTPs are **hashed** before storage (`Otp.codeHash`), never stored plaintext.
- OTPs are single-use, expire, and support attempt limits (`MAX_ATTEMPTS`).
- OTP purposes are a controlled enum — clients cannot supply arbitrary purposes.
- OTPs are never logged or returned in API responses.
- `send-otp` and `verify-otp` return generic responses to avoid enumeration.

## Password Reset

- Reset tokens are random, single-use, hashed before storage, and expire.
- Reset flow uses the `Otp` model with `purpose = password_reset`
  (the schema has no dedicated reset-token table — see `database-gaps.md`).
- `forgot-password` always returns a generic response (no enumeration).
- On reset, all sessions and refresh tokens are revoked.

## Email Verification

- Verification uses the `Otp` model with `purpose = email_verification`.
- Tokens expire, are single-use, and are stored hashed.
- Email sending uses the abstraction in `src/services/email/email.service.js`
  (no hardcoded SMTP provider).

## Brute-Force & Abuse Protection

Phase 20 prepares the following protections (without a distributed rate
limiter, which is planned for a later phase):

- Generic login/forgot-password responses prevent account enumeration.
- bcrypt cost factor slows credential guessing.
- OTP attempt limits and expiry.
- Refresh-token rotation + reuse detection limits token theft impact.
- Session revocation on password change/reset.

See `src/docs/auth-rate-limits.md` for recommended production rate limits.

## Audit Events

Authentication events are recorded via the `AuditLog` model:

`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_CHANGED`,
`PASSWORD_RESET`, `EMAIL_VERIFIED`, `OTP_SENT`, `OTP_VERIFIED`, `OTP_FAILED`,
`REFRESH_TOKEN_ROTATED`, `REFRESH_TOKEN_REUSE_DETECTED`.

**Never log:** passwords, tokens, OTPs, authorization headers, reset/verification
raw tokens, or bank/payment secrets.
