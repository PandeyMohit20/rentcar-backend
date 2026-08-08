# Auth + RBAC Completion — Implementation Tracking

## Fixes
- [ ] Fix `src/config/database.mock.js` — nested `role.permissions` include in `applyInclude`
- [ ] Fix `src/app.js` — `app.use(morgan(fmt), { skip })` → `morgan(fmt, { skip })`

## Test updates
- [ ] Update `tests/error-handler.test.js` — new auth error codes (AUTH_UNAUTHORIZED / AUTH_TOKEN_INVALID)

## New tests
- [ ] Create `tests/password.test.js`
- [ ] Create `tests/rbac.test.js`
- [ ] Create `tests/otp.test.js`
- [ ] Create `tests/email-verification.test.js`
- [ ] Create `tests/session.test.js`

## Validation & commit
- [ ] Run `npm install`, `npm run lint`, `npm test`, `npm run format`
- [ ] Verify `GET /api/v1/health` + `npm run check`
- [ ] Update `TODO.md` / `TASK_TODO.md`
- [ ] Git commit `feat(auth): implement authentication and RBAC`

