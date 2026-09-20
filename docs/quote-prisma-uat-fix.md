# Quote Prisma mismatch investigation — 2026-09-10

## Root cause and fix

Category A: stale generated Prisma Client. Before the fix, the installed client schema timestamp was August 12, 2026, and its Vendor DMMF omitted `taxProfile`. The actual HTTP endpoint returned 500 with `PrismaClientValidationError`, `taxProfile`, and a stack in the response. Repository `prisma/schema.prisma:479` declares `taxProfile Json? @map("tax_profile")`; existing migration `20260909090000_tax_invoice_email` adds the JSON column. A read-only information_schema query confirmed the column already exists. Prisma validate passed and migrate status reported all eight repository migrations applied.

The installed CLI, client, and lockfile versions are 5.22.0. The singleton imports `@prisma/client`; generation uses `prisma/schema.prisma` with the default output. Regenerated metadata includes the field, and generated schema matches the source ignoring formatting. No custom client or build is involved. Stopped the backend nodemon supervisor (600) and server (4136), regenerated successfully, and started a clean server (21764), the sole listener on port 5000. Frontend processes were left alone.

Schema changed: **NO**. Migration created/applied: **NO**. Prisma regenerated: **YES**. Backend cleanly restarted: **YES**.

The global error handler now replaces all 5xx messages/codes/details with a generic response in every environment, never returns stacks, and retains stacks in server logs. Safe operational 4xx responses remain intact; mapped Prisma errors do not retain raw details. Added regression tests for Prisma validation errors, operational server errors, unknown database errors, and safe 409 details.

## Actual HTTP validation

Public car search and MG Hector detail both returned 200. Repeated the same request before and after the repair:

```json
{
  "carId": "68dec66f-f98a-42e7-880a-2166065c76f3",
  "pickupDateTime": "2026-10-15T10:00:00+05:30",
  "returnDateTime": "2026-10-16T10:00:00+05:30"
}
```

`POST http://localhost:5000/api/v1/pricing/quote`: **500 before; 409 after**.

Actual sanitized quote-endpoint response (not a successful quote):

```json
{
  "success": false,
  "message": "PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION",
  "error": {
    "code": "PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION"
  }
}
```

Unexpected server errors now use:

```json
{
  "success": false,
  "message": "The service is temporarily unavailable. Please try again shortly.",
  "error": { "code": "INTERNAL_ERROR" }
}
```

## Remaining business blocker and pricing verification

The live setting `billing.issuer.phase7b.pending` explicitly has status `PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION`; approved GST rate and compensation cess are unset. All four vendors have null tax profiles. The quote service correctly stops at this guard. No tax configuration or guard was changed, and no zero-tax quote was substituted. A successful live quote, token, expiry, and payable total therefore cannot be claimed.

The selected car's stored active pricing is INR 3,800/day with INR 9,000 security deposit. The request is 24 hours. The existing pricing algorithm therefore gives a 3,800 rental subtotal, but tax and final payable remain unverified until approved configuration exists. Tax remains sourced from approved vehicle/category vendor policy and recipient billing status/location; the deposit is separate from the taxable rental base. The server signs financial snapshots and expiry into the quote token; booking consumes that signed snapshot and rejects client financial fields.

Targeted mocked tests passed (55 tests across pricing, availability, booking creation, tax snapshots, and error sanitization), including quote signature tampering/expiry rejection, customer binding, booking consumption, and immutable tax snapshots. The approved test fixture verifies 100 rent + 18 tax + 500 refundable deposit = 618 INR; those are test fixture values, not live tax approval.

Live booking/payment UAT **cannot resume** until approved GST/cess configuration and required customer billing information are available and a real quote succeeds. The configured Razorpay key has the test prefix; no payment order or charge was created and no live booking was made.

## Migration history observation

The tax migration checksum matches the database when Windows line endings are normalized. Other September migrations also match. The database additionally contains two historical August migration entries absent from this checkout, and the baseline checksum differs even after line-ending normalization. This was not the cause of the missing client field; history was left untouched. `migrate status` being up to date does not establish that historical baselines are identical.

## Files changed

- `src/errors/errorHandler.js`
- `tests/error-sanitization.test.js`
- `docs/quote-prisma-uat-fix.md`

Generated client and restored dependencies are local ignored artifacts. No frontend, pricing logic, schema, migration, environment, or payment security changes.

## Quality checks

The initial full suite exposed a stale dependency installation: `pdfkit` was declared but absent. Restored declared dependencies with `npm install --ignore-scripts --package-lock=false --no-audit --no-fund`; package manifests and lockfile remain unchanged. Restarted again afterward; final backend PID is 4640 and the repeat quote response remains the same safe 409.

- Targeted tests: 5 suites / 55 tests passed.
- Final full `npm test -- --silent`: **52 suites / 319 tests passed** after restoring dependencies.
- Changed JavaScript files: ESLint passed.
- Repository lint: fails on four existing single-quote errors in `scripts/recover-local-uat-admin.js:40-43`, with four console warnings in that file. Unrelated script left untouched.
- Build: no build script exists; this backend runs source JavaScript directly. `npm run check` passed after dependency restoration.
- `git diff --check`: passed.

For subsequent updates, install declared dependencies and run `npx prisma generate --schema prisma/schema.prisma` before starting a fresh backend process. Generation does not apply database migrations.
