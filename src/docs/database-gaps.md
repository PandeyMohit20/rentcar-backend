# Database Gaps — Phase 20

The backend consumes the Prisma Client generated from `rentcar-database`
(single source of truth). Per the project rules, the backend does **not**
modify the schema or create migrations. During Phase 20 the following gaps were
identified and workarounds applied. A future `rentcar-database` migration is
recommended to close them.

## 1. No dedicated reset-token table

The schema has no dedicated password-reset token model.

**Workaround applied:** The `Otp` model is used with
`purpose = password_reset`. The reset token is random, single-use, hashed
(`codeHash`), and expires.

**Recommended migration for rentcar-database:** Add a `PasswordResetToken`
table (or reuse `Otp`) with explicit `tokenHash`, `expiresAt`, `usedAt`,
`userId` relation. The current `Otp`-based approach is fully functional.

## 2. No dedicated email-verification token table

The schema has no email-verification token model.

**Workaround applied:** The `Otp` model is used with
`purpose = email_verification`.

**Recommended migration:** Consider a dedicated verification-token table if
longer-lived tokens are preferred over numeric OTPs.

## 3. RefreshToken lacks a sessionId relation

`RefreshToken` has `userId`, `tokenHash`, `expiresAt`, `revokedAt` but **no**
`sessionId` column. This prevents scoping refresh tokens to a specific session.

**Workaround applied:** Refresh tokens store the `sessionId` inside the JWT
payload. Revocation of a session revokes all of the user's refresh tokens
(broader than session-scoped).

**Recommended migration:** Add `sessionId String? @db.VarChar(36)` to
`RefreshToken` with a relation to `Session`, plus an index. This enables
session-scoped refresh-token revocation.

## 4. OtpPurposeEnum values are lowercase

`OtpPurposeEnum` uses lowercase values (`registration`, `login`,
`password_reset`, etc.).

**Workaround applied:** `src/modules/auth/constants.js` maps the uppercase
application constants to the lowercase enum values accepted by the database.

## Summary

No schema changes were made in `rentcar-backend`. All Phase 20 functionality is
compatible with the current schema. The recommended migrations above are
optional improvements for a future `rentcar-database` phase.
