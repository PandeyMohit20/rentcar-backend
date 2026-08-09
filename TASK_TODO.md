# Phase 21 — User & Profile Management

## Plan

**Information gathered:**
- Backend uses shared Prisma client (`src/config/database.js`), mock in tests.
- Schema supports `User`, `Profile`, `Address`, `AuditLog`, `ActivityLog`. No preferences model.
- `UserStatusEnum` is lowercase (active/inactive/pending/suspended/blocked/deleted).
- `authenticate` middleware currently leaves `roles`/`permissions` empty → must wire DB-backed RBAC so `authorize()` works.
- Layered pattern: controller → service → repository, Zod validation, standardized response/error utils.

## Steps
- [x] 1. Explore repo, schema, patterns
- [ ] 2. Update shared infra: permissions, errorCodes, database mock (address + count/findMany enhance), authenticate (RBAC), routes/index mounting
- [ ] 3. Create users module (constants, mapper, repository, service, controller, validator, routes)
- [ ] 4. Create profiles module
- [ ] 5. Create addresses module
- [ ] 6. Update test helpers (seedAddress, seedProfile)
- [ ] 7. Create tests (users list/profile/update/status/delete, addresses, preferences, authorization)
- [ ] 8. Create docs (users-api.md, user-security.md, update database-gaps.md)
- [ ] 9. Run lint, tests, format; fix issues
- [ ] 10. Final validation + git commit

## Dependent files to edit
- src/constants/permissions.js
- src/errors/errorCodes.js
- src/config/database.mock.js
- src/middlewares/authenticate.js
- src/routes/index.js
- tests/helpers/auth.js
- src/docs/database-gaps.md

## New files
- src/modules/users/* (7 files)
- src/modules/profiles/* (6 files)
- src/modules/addresses/* (5 files)
- src/docs/users-api.md, src/docs/user-security.md
- tests/users/* (8 test files)
