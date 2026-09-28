# M11: payout safety storage only

Migration: `20260928143500_add_vendor_settlement_payout_safety`.
Adds only `vendor_settlement_payout_attempts`. No existing rows are backfilled.
Phase C generation hashes, financial snapshots, existing enums and payoutReference
remain unchanged. There are no payout commands, provider calls or DTO additions.

## Durable evidence

Each attempt has a UUID, settlement, sequential attempt number, payout-specific
SHA-256 key/request hashes, normalized provider, nullable provider reference,
selected bank account, SHA-256 destination fingerprint, JSON destination snapshot,
Decimal(14,2) amount, currency, required initiating User and UTC millisecond timestamps.
The actor, bank and settlement FKs use DELETE RESTRICT to preserve history.
Physical actor deletion is blocked while attempts exist; existing soft deletion remains possible.

The independent enum means: prepared (durably recorded), dispatching (dispatch
authorization established), unknown (ambiguous external result), pending (provider
accepted but nonterminal), succeeded (confirmed success), failed (definitive failure).
M11 does not enforce the state machine or create attempts in the imported database.

Unique pairs are settlement/attempt number, settlement/key hash and provider/provider
payout ID. MySQL permits multiple NULL provider references. Raw client keys must
never be persisted. Provider IDs in isolated constraint fixtures are test identifiers,
never evidence of a provider call.

Indexes cover settlement/status, provider/status and status/lastReconciledAt.
Separate bank and actor indexes support their FKs. Standalone settlement/provider
indexes are unnecessary because existing composite prefixes cover them.

## Required future service contracts

- Capture only minimum necessary destination facts; fingerprint a canonical snapshot.
  Never log, audit or return destinationSnapshot or hashes. M11 adds JSON storage,
  not encryption or automatic SQL immutability. An appropriate sensitive-data
  protection policy must be implemented before any real payout destination is stored.
- Validate ownership, bank usability, supported currency and positive amount at
  preparation. Use the frozen attempt destination after preparation even if the
  source bank record changes. No bank edit locks are introduced here.
- Enforce immutable attempt request fields and `attempt.amount == settlement.netPayable`.
  Preserve item/header totals, historical commission and deposit separation.
  Cross-table financial equality is deliberately not a SQL CHECK constraint.
- Normalize provider identifiers/statuses and safe failure codes; hashes must be
  64-character SHA-256 hex. Enforce positive attempt numbers and monetary bounds
  in future commands. String capacity does not itself establish valid content.
- Persist later legitimate payment/refund truth. Flag affected pending, processing,
  paid and failed settlements using existing requiresFinancialReview/reason fields.
  Do not rewrite financial snapshots, reject legitimate refunds, or automatically
  reverse payouts. Those fields suffice to flag exposure; resolution/accounting is
  separate future work. M11 changes no financial-review writer.
- `VendorSettlement.processedAt` will mean provider-confirmed terminal payout
  success time, never initiation time. Attempt timestamps preserve attempt history.
- Attempts are authoritative payout history; payoutReference may remain a compatible
  safe summary. No reference backfill or reversal semantics are introduced.
- Future dispatch/reconciliation must preserve car-first lock ordering and durable
  provider idempotency/recovery. A schema alone cannot guarantee exactly-once external
  effects. Real providers remain disabled until separately authorized and proven safe.

## Controlled validation and deployment

Run `node scripts/payout-foundation-validation.js validate` before deployment.
It verifies the local fingerprint/history, copies only the existing M10 schema to
a task-created database, inserts isolated fixtures before M11, applies exact M11
SQL, and exercises nullable uniqueness, compound selectors, restrictive FKs,
decimal/JSON persistence and historical-row survival. It drops only its own named
database after successful checks. Failure stops and retains the isolated database.
No imported rows are copied into fixtures. No provider adapter is loaded.

Run `node scripts/payout-foundation-validation.js predeploy`, then the authorized
`npx prisma migrate deploy` only if M11 is the sole pending migration. Run
`node scripts/payout-foundation-validation.js verify` afterward. Evidence contains
counts, hashes and schema metadata, never bank snapshots, secrets or business rows.
Historical migration file hashes and business-row digests must remain unchanged.
The legacy August records remain intact. Known M8/M9 CRLF checkout checksums match
recorded LF checksums; no byte normalization is performed. Baseline/BOM bootstrap
debt is explicitly outside this upgrade validation.

Generated-client metadata tests do not connect to MySQL. Actual SQL constraints are
verified by the isolated script; the existing application mock need not emulate an
unused payout API. Future Phase D behavior will need its own mock/provider tests and
real-MySQL concurrency proof.
