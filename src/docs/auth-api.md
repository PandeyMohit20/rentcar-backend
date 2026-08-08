# Auth API Documentation

Base URL: `http://localhost:5000/api/v1`

All routes are versioned under `/api/v1/auth`.

## Response Format

Success:

```json
{ "success": true, "message": "...", "data": {} }
```

Error:

```json
{ "success": false, "message": "...", "error": { "code": "ERROR_CODE" } }
```

---

## POST /auth/register

Creates a new user account with the default `CUSTOMER` role.

**Authentication:** None

**Request body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919999999999",
  "password": "StrongPassword123!"
}
```

**Validation:** name (2–255), email (valid/lowercased), phone (optional), password (policy).

**Success (201):**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": { "id": "...", "name": "John Doe", "email": "john@example.com", "roles": ["CUSTOMER"] }
  }
}
```

**Errors:** `AUTH_EMAIL_EXISTS` (409), `AUTH_PHONE_EXISTS` (409), validation (422).

---

## POST /auth/login

Authenticates a user and returns an access token; the refresh token is set as an HttpOnly cookie.

**Authentication:** None

**Request body:**

```json
{ "email": "john@example.com", "password": "StrongPassword123!" }
```

**Success (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "...", "email": "john@example.com", "roles": ["CUSTOMER"], "permissions": [] },
    "accessToken": "eyJ...",
    "sessionId": "...",
    "expiresAt": "..."
  }
}
```

**Errors:** `AUTH_INVALID_CREDENTIALS` (401, generic), `AUTH_ACCOUNT_BLOCKED` (403), `AUTH_ACCOUNT_SUSPENDED` (403), `AUTH_ACCOUNT_INACTIVE` (401).

---

## POST /auth/refresh

Rotates the refresh token and returns a fresh access token + new refresh token.

**Authentication:** Refresh token (body `refreshToken` OR `refresh_token` cookie)

**Request body (optional):**

```json
{ "refreshToken": "..." }
```

**Success (200):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": { "accessToken": "eyJ...", "refreshToken": "...", "sessionId": "...", "expiresAt": "..." }
}
```

**Errors:** `AUTH_TOKEN_INVALID` (401), `AUTH_TOKEN_EXPIRED` (401), `AUTH_REFRESH_TOKEN_REVOKED` (401), `AUTH_REFRESH_TOKEN_REUSE` (401), `AUTH_SESSION_INVALID` (401).

---

## POST /auth/logout

Revokes the current session + its refresh tokens and clears the cookie.

**Authentication:** Bearer access token.

**Success (200):** `{ "success": true, "message": "Logged out successfully" }`

Logout is idempotent.

---

## POST /auth/logout-all

Revokes all sessions and refresh tokens for the current user.

**Authentication:** Bearer access token.

**Success (200):** `{ "success": true, "message": "Logged out of all devices" }`

---

## GET /auth/me

Returns the current user with roles and permissions.

**Authentication:** Bearer access token.

**Success (200):**

```json
{
  "success": true,
  "message": "Current user",
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919999999999",
      "status": "active",
      "emailVerifiedAt": null,
      "roles": ["CUSTOMER"],
      "permissions": [],
      "profile": null
    }
  }
}
```

---

## POST /auth/change-password

Changes the current user's password and revokes other sessions.

**Authentication:** Bearer access token.

**Request body:**

```json
{ "currentPassword": "...", "newPassword": "NewStrongPassword123!" }
```

**Success (200):** `{ "success": true, "message": "Password changed successfully" }`

**Errors:** `AUTH_PASSWORD_INVALID` (401).

---

## POST /auth/forgot-password

Requests a password reset. Always returns a generic response (no account enumeration).

**Authentication:** None

**Request body:**

```json
{ "email": "john@example.com" }
```

**Success (200):**

```json
{
  "success": true,
  "message": "If the account exists, password reset instructions have been sent.",
  "data": {}
}
```

---

## POST /auth/reset-password

Resets the password using a secure reset token.

**Authentication:** None

**Request body:**

```json
{ "token": "...", "newPassword": "NewStrongPassword123!" }
```

**Success (200):** `{ "success": true, "message": "Password has been reset" }`

**Errors:** `AUTH_RESET_TOKEN_INVALID` (400), `AUTH_RESET_TOKEN_EXPIRED` (400).

---

## POST /auth/verify-email

Verifies the user's email using a one-time verification token.

**Authentication:** None

**Request body:**

```json
{ "token": "..." }
```

**Success (200):** `{ "success": true, "message": "Email verified successfully" }`

**Errors:** `AUTH_VERIFICATION_TOKEN_INVALID` (400), `AUTH_EMAIL_NOT_VERIFIED` (400).

---

## POST /auth/resend-verification

Resends the email verification message. Generic response.

**Authentication:** None

**Request body:**

```json
{ "email": "john@example.com" }
```

---

## POST /auth/send-otp

Sends an OTP for a controlled purpose.

**Authentication:** None

**Request body:**

```json
{ "email": "john@example.com", "purpose": "login" }
```

`purpose` must be one of: `registration`, `login`, `password_reset`, `email_verification`, `phone_verification`, `delete_account`.

**Success (200):** generic response.

---

## POST /auth/verify-otp

Verifies an OTP.

**Authentication:** None

**Request body:**

```json
{ "email": "john@example.com", "purpose": "login", "otp": "123456" }
```

**Errors:** `AUTH_OTP_INVALID` (400), `AUTH_OTP_EXPIRED` (400), `AUTH_OTP_MAX_ATTEMPTS` (400).
