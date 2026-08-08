# RentCar Backend

Production-ready backend foundation for the RentCar SaaS platform.

**Phase 19** — architecture and infrastructure. Business modules (auth, users,
vendors, cars, bookings, payments, etc.) are implemented in later phases.

## Project Overview

RentCar is a multi-tenant SaaS platform for car rental. This repository contains
the **backend API** built with Node.js, Express, Prisma Client, and MySQL.

## Architecture

- **Modular architecture** — each business domain is a module under `src/modules/`.
- **Layered design** — controllers → services → repositories.
- **Config centralization** — environment, database, CORS, and logger live in `src/config/`.
- **API versioning** — all routes are prefixed with `/api/v1`.
- **Security-first** — Helmet, CORS, JWT, bcrypt, Zod validation, sanitized errors.

## Technology Stack

- Node.js
- Express.js
- Prisma Client (generated from `rentcar-database`)
- MySQL
- JWT (jsonwebtoken)
- bcrypt
- Zod (validation)
- Helmet, CORS, Morgan, Compression
- Jest + Supertest (testing)
- ESLint + Prettier

## Requirements

- Node.js 18+
- npm 9+
- MySQL 8+
- `rentcar-database` repository (for the generated Prisma Client)

## Installation

```bash
# 1. Install backend dependencies
npm install

# 2. Copies the generated Prisma Client from rentcar-database
#    See src/docs/database-integration.md for the integration approach.

# 3. Create environment file
cp .env.example .env
# Edit .env with real values (DATABASE_URL, JWT secrets, etc.)
```

## Environment Variables

See `.env.example` for all variables. Required:

| Variable                 | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `NODE_ENV`               | `development`, `test`, `production`, or `staging` |
| `PORT`                   | HTTP port                                         |
| `API_PREFIX`             | API version prefix (default `/api/v1`)            |
| `DATABASE_URL`           | MySQL connection string                           |
| `JWT_ACCESS_SECRET`      | Secret for access tokens (min 16 chars)           |
| `JWT_REFRESH_SECRET`     | Secret for refresh tokens (min 16 chars)          |
| `JWT_ACCESS_EXPIRES_IN`  | Access token expiry (e.g. `15m`)                  |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (e.g. `7d`)                  |
| `CORS_ORIGIN`            | Comma-separated allowed origins                   |
| `LOG_LEVEL`              | `silent`, `error`, `warn`, `info`, `debug`        |
| `COOKIE_SECURE`          | `true`/`false`                                    |
| `COOKIE_SAME_SITE`       | `lax`, `strict`, or `none`                        |

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Database Integration

The backend consumes the Prisma Client generated from `rentcar-database`
(the single source of truth for the schema). See
`src/docs/database-integration.md` for details.

## API Versioning

All REST endpoints are versioned:

```
/api/v1/health
/api/v1/auth
/api/v1/users
/api/v1/cars
/api/v1/bookings
```

## Authentication

Token-based authentication foundation is in place. Full login/register/refresh
is implemented in Phase 20.

- Access tokens via `Authorization: Bearer <token>`.
- See `src/utils/jwt.js` and `src/middlewares/authenticate.js`.

## Error Handling

- Centralized global error handler.
- Standardized response format.
- Prisma errors mapped to safe HTTP responses.
- Production never exposes stack traces, secrets, SQL, or DB credentials.

## Testing

```bash
npm test          # run tests once
npm run test:watch
```

Tests use an in-memory mocked database (`TEST_DATABASE_MOCK=true`) and never
touch a real/production database.

## Linting & Formatting

```bash
npm run lint
npm run format
```

## Security

See `src/docs/security.md` for the full security documentation.

## Folder Structure

```
rentcar-backend/
├── src/
│   ├── config/          # env, database, cors, logger
│   ├── controllers/     # (shared) thin request handlers
│   ├── services/        # (shared) business logic
│   ├── repositories/    # (shared) data access
│   ├── routes/          # route mounting
│   ├── middlewares/     # authenticate, authorize, validate, requestId
│   ├── validators/      # shared Zod schemas
│   ├── utils/           # jwt, password, response, pagination, etc.
│   ├── constants/       # httpStatus, roles, permissions, statuses
│   ├── errors/          # AppError, errorCodes, handlers
│   ├── modules/         # per-domain modules (auth, users, cars, ...)
│   ├── docs/            # api, database-integration, security
│   ├── health/          # health controller/service/routes
│   ├── app.js           # Express app factory
│   └── server.js        # bootstrap + graceful shutdown
├── tests/               # Jest tests
├── scripts/             # scaffold, check, health
├── .env.example
├── .env.test.example
├── .gitignore
├── .eslintrc
├── .prettierrc
├── package.json
└── README.md
```

## Development Workflow

1. Create a `.env` from `.env.example`.
2. Ensure `rentcar-database` has generated the Prisma Client.
3. Run `npm run dev`.
4. Verify `GET /api/v1/health`.
5. Run `npm run check` for a startup sanity check.
6. Run `npm test`, `npm run lint`, `npm run format` before committing.
