# RentCar API Documentation

## Base URL

```
http://localhost:5000
```

## API Versioning

All REST endpoints are versioned and prefixed with `/api/v1`.

```
/api/v1/health
/api/v1/auth
/api/v1/users
/api/v1/vendors
/api/v1/cars
/api/v1/bookings
```

## Response Format

### Success

```json
{
  "success": true,
  "message": "Request successful",
  "data": {},
  "meta": {}
}
```

- `data` — the resource payload (object or array).
- `meta` — optional pagination metadata etc.

### Error

```json
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

- `error.code` — canonical machine-readable code.
- `error.details` — optional structured details.
- Stack traces are **never** exposed in production.

## HTTP Status Codes

| Code | Meaning               |
| ---- | --------------------- |
| 200  | OK                    |
| 201  | Created               |
| 204  | No Content            |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 422  | Unprocessable Entity  |
| 429  | Too Many Requests     |
| 500  | Internal Server Error |
| 503  | Service Unavailable   |

## Authentication

Protected endpoints expect an access token:

```
Authorization: Bearer <access_token>
```

Token types:

- **Access token** — short-lived, signed with `JWT_ACCESS_SECRET`.
- **Refresh token** — long-lived, signed with `JWT_REFRESH_SECRET`.

Authorization is permission-based:

```
authorize('bookings.create')
authorize(['users.view', 'admin.all'])
```

## Request ID

Every response includes an `X-Request-ID` header. Client-generated IDs are
honored if sent as `X-Request-ID`; otherwise a UUID is generated.

## Pagination

List endpoints accept `page` and `limit` query params.

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

- Default `page` = 1.
- Default `limit` = 20.
- Maximum `limit` = 100.

## Validation

Request bodies are validated with Zod. Validation failures return `422` with a
`VALIDATION_ERROR` code and structured issues.

## Health

```
GET /api/v1/health
GET /api/v1/health/database
```
