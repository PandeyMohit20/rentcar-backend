# Phase 20 — Authentication + Authorization + RBAC

## Foundation
- [ ] Update `src/config/env.js` to add `COOKIE_DOMAIN`
- [ ] Update `.env.example` and `.env.test.example` with `COOKIE_DOMAIN`
- [ ] Update `src/constants/roles.js` with full system roles
- [ ] Update `src/constants/permissions.js` with settings/wallet permissions
- [ ] Add auth error codes to `src/errors/errorCodes.js`

## Shared services & middleware
- [ ] Create `src/services/authorization.service.js`
- [ ] Create `src/services/email/email.service.js`
- [ ] Upgrade `src/middlewares/authenticate.js` (DB-backed, session/status checks)
- [ ] Upgrade `src/middlewares/authorize.js` (use authorization.service)

## Auth module
- [ ] Create `src/modules/auth/auth.utils.js`
- [ ] Update `src/modules/auth/constants.js`
- [ ] Update `src/modules/auth/validator.js` (Zod schemas + centralized password policy)
- [ ] Update `src/modules/auth/repository.js`
- [ ] Update `src/modules/auth/service.js`
- [ ] Update `src/modules/auth/controller.js`
- [ ] Update `src/modules/auth/routes.js`

## Docs
- [ ] Create `src/docs/auth-api.md`
- [ ] Create `src/docs/auth-security.md`
- [ ] Create `src/docs/auth-rate-limits.md`
- [ ] Create `src/docs/database-gaps.md`

## Tests
- [ ] Create test helper/mock for Prisma auth models
- [ ] register.test.js
- [ ] login.test.js
- [ ] refresh.test.js
- [ ] logout.test.js
- [ ] password.test.js
- [ ] rbac.test.js
- [ ] otp.test.js
- [ ] email-verification.test.js
- [ ] session.test.js

## Validation & commit
- [ ] Run `npm install`, `npm run lint`, `npm test`, `npm run format`
- [ ] Verify `GET /api/v1/health`
- [ ] Git commit `feat(auth): implement authentication and RBAC`
