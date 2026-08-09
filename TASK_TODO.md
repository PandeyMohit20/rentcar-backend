# Phase 21 — User & Profile Management

## Status

- Phase 21 is in progress.
- The users module is implemented in `src/modules/users` with self-service and admin user management endpoints.
- A profile module exists in `src/modules/profiles` but has no dedicated route mounting yet.
- Address support is partially present in `src/modules/users` (user detail includes addresses), but a dedicated addresses module and CRUD endpoints are not implemented.
- Preferences endpoints exist in the users module, but update support is intentionally unavailable due to a schema gap.

## Plan

**Information gathered:**

- Backend uses shared Prisma client (`src/config/database.js`) and an in-memory Prisma mock for tests.
- Schema supports `User`, `Profile`, `Address`, `AuditLog`, `ActivityLog`.
- `USER_STATUS` values are lowercase (`active`, `inactive`, `pending`, `suspended`, `blocked`, `deleted`).
- `authenticate` middleware already resolves DB-backed roles and permissions for RBAC.
- `users` routes are mounted in `src/routes/index.js`.
- `profiles` module logic exists, but separate profile route mounting is still pending.
- `preferences` are documented as a schema gap in `UsersService`.

## Steps

- [x] 1. Explore repo, schema, patterns
- [x] 2. Update shared infra: permissions, errorCodes, database mock, authenticate RBAC, routes/index mounting
- [x] 3. Create users module (constants, mapper, repository, service, controller, validator, routes)
- [x] 4. Create profiles module (service/controller/validator/repository/mapper)
- [ ] 5. Create addresses module or add dedicated address management endpoints
- [ ] 6. Update test helpers (explicit seedAddress, seedProfile helpers)
- [ ] 7. Create tests (users list/profile/update/status/delete, addresses, preferences, authorization)
- [ ] 8. Create docs (`src/docs/users-api.md`, `src/docs/user-security.md`, update `src/docs/database-gaps.md`)
- [ ] 9. Run lint, tests, format; fix issues
- [ ] 10. Final validation + git commit

## Current Gaps

- No `src/modules/addresses` module exists.
- No dedicated profile route module is mounted.
- Preferences update is not supported by the schema and returns a service unavailable error.
- No `tests/users/*` files exist.
- No `src/docs/users-api.md` or `src/docs/user-security.md` exist.

## Dependent files to edit

- src/constants/permissions.js
- src/errors/errorCodes.js
- src/config/database.mock.js
- src/middlewares/authenticate.js
- src/routes/index.js
- tests/helpers/auth.js
- src/docs/database-gaps.md

## New / Updated files

- src/modules/users/*
- src/modules/profiles/*
- src/docs/users-api.md
- src/docs/user-security.md
- tests/users/*
- tests/helpers/auth.js (add seedAddress / seedProfile helpers)
