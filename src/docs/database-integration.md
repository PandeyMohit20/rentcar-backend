# Database Integration — rentcar-database

## Ownership

`rentcar-database` is the **single source of truth** for the database schema,
models, enums, migrations, and seed data.

The backend **never**:

- Creates its own Prisma schema.
- Duplicates `schema.prisma`.
- Runs manual DDL.
- Creates or alters database tables independently.

## Prisma Client

The Prisma Client is generated from `rentcar-database`:

```bash
# In rentcar-database
npm install
npm run prisma:generate   # prisma generate
```

The generated `@prisma/client` is then made available to the backend via a
workspace/symlink or package publishing. The backend imports it normally:

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
```

The backend shares a single PrismaClient instance from `src/config/database.js`.
Services and repositories consume it; controllers never instantiate Prisma.

## DATABASE_URL

The backend connects using the same `DATABASE_URL` convention:

```
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/rentcar"
```

Set it in the backend's environment (never committed).

## Migrations

Migrations are created and owned in `rentcar-database`:

```bash
npm run prisma:migrate   # prisma migrate dev (development)
npm run prisma:deploy    # prisma migrate deploy (production)
```

The backend applies migrations via `prisma migrate deploy` in production and
never runs `prisma migrate reset` in production.

## Schema Change Workflow

1. Update `prisma/schema.prisma` in `rentcar-database`.
2. Create a migration (dev).
3. Update ERD and documentation.
4. Validate (`prisma validate`, `db:validate`).
5. Backend picks up the new client after `prisma generate`.

Backend developers must **not** create database tables independently.

## Transaction Usage

Use `prisma.$transaction` for atomic flows:

- Booking creation/cancellation
- Payment/refund creation
- Wallet debits/credits
- Coupon usage
- Vendor settlement

The backend exposes a `withTransaction(fn)` helper in
`src/utils/transaction.js`.

## Repository Usage

Queries are centralized behind repositories/services mapped to domain models.
Never bypass the Prisma Client with raw SQL for Prisma-managed tables.
