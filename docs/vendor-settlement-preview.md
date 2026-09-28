# Vendor settlement preview

`GET /api/v1/vendors/:vendorId/settlements/preview` is informational, read-only and not a reservation.
It accepts `page` (1–100000, default 1), `pageSize` (1–100, default 20), and optional uppercase three-letter `currency`.
Only completed bookings owned by this vendor are candidates. No period semantics or booking-ID selection is introduced.

Both preview and the existing settlement list use centralized permission checks: `admin.all` (including the
SUPER_ADMIN/wildcard convention) permits global reads; otherwise `vendors.view` and a VendorMember row matching
the actor's user ID and requested vendor ID are required. Nonmembers receive 404 without a vendor existence lookup.
Generic vendor permission and `kyc.review` confer no global settlement access. No seed changes are required.
Future dedicated settlement view/generate permissions require a separate permission provisioning and admin role
mapping rollout; this phase does not introduce or depend on those permissions.

Preview reads a consistent RepeatableRead transaction without locks or writes. All payment attempts for the
bounded booking page are inspected using the existing recovery selector. Reconciliation audit history is limited
to 201 rows per booking; exceeding 200 blocks eligibility instead of implying older evidence is clear. A later
successful reconciliation does not erase earlier conflict evidence: there is no persisted explicit resolution state.

Response: `data` contains `observedAt`, `bookings`, `summary`, and computed `generationReady`/`netPayable`;
`meta` contains `page`, `pageSize`, `total`, `totalPages`. Each booking contains financialFacts, safe payment facts,
refund totals/unresolved statuses, settlementState, eligibleForReview, generationReady, netPayable and blockers.
Money and commission rates use exact two-decimal strings. Missing or invalid evidence is never converted into zero.
The commission amount is the stored `vendorCommision`, never recalculated using any vendor rate.

Summary `scope: page`, `inclusion: eligibleForReview` describes its coverage explicitly. Each currency group shows
bookingCount, includedBookingCount, excludedBookingCount and exact financial totals for eligible rows only.
Blocked rows remain visible individually; their possibly inconsistent amounts do not pollute aggregates.
Zero included bookings means zero included totals, not a claim that excluded bookings had no captured money.
Tax and original deposit remain separate facts, with no inferred deposit disposition or refund allocation.

Blocker codes:

- VENDOR_MISMATCH, BOOKING_NOT_COMPLETED, CURRENCY_INVALID
- BOOKING_FINANCIAL_FACT_INVALID, COMMISSION_SNAPSHOT_INVALID, DISCOUNT_INTERPRETATION_REQUIRED
- CAPTURED_PAYMENT_MISSING, MULTIPLE_CAPTURED_PAYMENTS, PAYMENT_REVIEW_REQUIRED, LATE_PAYMENT_CONFLICT
- PAYMENT_CAPTURE_EVIDENCE_INCOMPLETE, PAYMENT_ASSOCIATION_MISMATCH, PAYMENT_AMOUNT_MISMATCH, PAYMENT_CURRENCY_MISMATCH
- REFUND_FACTS_INVALID, REFUND_UNRESOLVED, REFUND_TOTAL_IMPOSSIBLE, REFUND_EVIDENCE_INCOMPLETE
- RECONCILIATION_REVIEW_REQUIRED, RECONCILIATION_EVIDENCE_INCOMPLETE
- ALREADY_SETTLED, BOOKING_SETTLED_OTHER_PAYMENT
- COMPLETION_EVIDENCE_INVALID, FINANCIAL_SNAPSHOT_UNSUPPORTED, PAYMENT_NOT_SUCCEEDED
- REFUND_ACTIVITY_PRESENT, SETTLEMENT_CURRENCY_UNSUPPORTED, NET_PAYABLE_INVALID

Preview itself performs no mutation, provider call, reconciliation call, or reservation. Phase C below adds explicit generation.
`eligibleForReview` retains the Phase A/B informational review classification; `generationReady` additionally requires
all v1 completion, production snapshot, currency, and no-refund checks. Page financial summaries remain review-fact
summaries, not payout balances. Page-level net payable is present only for a nonempty page whose rows are all generation-ready.

## M10: Phase C settlement-generation safety foundation

`20260928110920_add_vendor_settlement_generation_safety` adds persistence only:
nullable `idempotencyKeyHash` and `requestHash`, a unique constraint on
`(vendorId, idempotencyKeyHash)`, `requiresFinancialReview` (non-null, default
false), and nullable `financialReviewReason`. Existing fields and relations
remain unchanged. MySQL permits multiple NULL keys; a non-null key hash must
be unique within a vendor, but may be reused by another vendor.

Future generation must populate both hashes for every new generated settlement.
Database nullability preserves compatibility with historical/non-generation
rows. `idempotencyKeyHash` is SHA-256 of the safely normalized Idempotency-Key,
stored as lowercase 64-character hex. Never persist or log the raw key.
`requestHash` is SHA-256 of a stable canonical serialization containing the
policy version, vendorId, normalized uppercase currencyCode, and sorted unique
bookingIds. Hashing and replay/conflict service logic are not implemented by M10.

`requiresFinancialReview=false` means no later financial conflict has been
recorded against the settlement; it is not proof of payout eligibility. Later
legitimate supported refund/reconciliation events may atomically set it true
and set a safe internal `financialReviewReason`. Never reject legitimate
financial truth merely because a settlement is pending, automatically rewrite
the original financial snapshot, or automatically clear the review flag.
Review state is not settlement failure: do not overload `status=failed` or
`failureReason`. The review reason must contain no provider secrets or customer
PII; audit/activity history remains the durable event history.

Future numbering may use `VS-<full UUID>` (39 characters), within the existing
`settlement_number` VARCHAR(50). Its existing unique constraint remains the
database authority. No COUNT-based numbering or additional sequence is needed.

M10 does not implement generation, a generation endpoint, payout, or changes
to refund/reconciliation writers. The preview remains read-only; the Phase C section defines generation readiness.
GST inclusion in future earned payable is the separately approved project
business policy for supported clean production snapshots; M10 performs no
financial calculation. Fresh-install baseline/BOM tooling debt is separate
from this additive foundation and is not addressed here.


## Phase C: pending settlement generation v1

`POST /api/v1/vendors/:vendorId/settlements` requires authentication and central
`admin.all` authority (including SUPER_ADMIN). Vendor membership does not permit
generation. Existing list/preview access remains unchanged.

The strict body is `{ "bookingIds": ["uuid"], "currencyCode": "INR" }`.
Supply 1?100 distinct UUIDs; IDs normalize to lowercase. Currency trims and
uppercases and requires the project three-letter currency-code format. V1 generation
supports INR, matching supported production GST snapshots. Other currencies fail eligibility.
The required `Idempotency-Key` trims surrounding whitespace, then requires
1?200 printable ASCII characters without internal whitespace. Keys are case
sensitive. Raw keys are never persisted, logged, or returned by generation.

New generation returns HTTP 201; exact replay returns HTTP 200 with
`replayed: true`. The standard envelope contains `{ settlement, replayed }`.
The settlement DTO omits both hashes and provider identities. Monetary amounts
are exact two-decimal strings. A pending ledger is an internal historical
snapshot, not a payout or proof of payout readiness.

The key hash is lowercase SHA-256 hex. Request hashing uses the explicitly
ordered JSON array `["vendor-settlement-v1", vendorId, currencyCode, sortedBookingIds]`.
The same vendor/key/request returns the original ledger and does not create
another item or audit event. A changed request conflicts. Invalid currency syntax is rejected during validation; a changed syntactically valid
currency under an existing key returns an idempotency conflict. The vendor/key unique constraint
and existing booking/payment-pair uniqueness remain final database authorities.
Only an idempotency-key-related P2002 permits replay lookup; other uniqueness
violations fail closed.

Preview and generation use the same eligibility evaluator. Generation re-reads
inside its transaction. Requirements include completed booking, succeeded booking
and authoritative payment, exactly one capture-bearing attempt, valid normal
capture evidence/associations, no reconciliation conflict, archived trip with
ordered actual timestamps and completion operator/odometer evidence, valid stored
commission, supported version-2 production financial and seller snapshots, zero
unsupported charges/discounts, no persisted refund of any status, and no existing
settlement association. Refunds are read by booking and all payment attempts.
Missing, UAT, ambiguous, or inconsistent snapshots block readiness. Existing
informational facts remain visible even when generation is blocked.

Approved **project business policy** for supported clean production snapshots:
`netAmount = Booking.subtotal + Booking.tax - Booking.vendorCommision`.
GST is included under that approval, not inferred accounting authority. Current
vendor commission is never used. Security deposit is stored separately as an
informational amount and neither added to nor subtracted from earned payable.
All arithmetic uses integer minor units, without floating-point money sums.
Header values sum item snapshots; refunds and adjustments are zero. Bank account,
processed/failed timestamps and failure reason are null. Initial status is pending.
Period bounds are the minimum/maximum actual archived trip end times. A single
completion may yield equal bounds. Numbers use `VS-<full UUID>` plus DB uniqueness.

Generation locks distinct car IDs in sorted order **before any transaction
snapshot reads**, then sorted booking IDs and each booking's payment rows in ID
order. Existing capture/reconciliation use the same car-first boundary. Pickup
and return now also acquire Car before Booking. Refund confirmations/webhooks
and refund-failure persistence join that boundary. Booking/car association is
revalidated after locking. All header/items and the single
`vendor.settlement.generate` audit commit atomically. Audit failure rolls back.
Recognized P2034 and raw deadlock/serialization errors receive at most three
transaction attempts; semantic/auth/validation/idempotency errors are not retried.
No provider work is inside generation or its retry loop.

Later supported refund/payment events and reconciliation attempts preserve
financial truth while atomically setting pending settlements' review flag with
a bounded category reason. Original header/item amounts and pending status stay
unchanged. Review flags never clear automatically; the first reason is retained.
Reconciliation starting or recording ambiguity conservatively flags an existing
pending ledger even before external verification finishes. Its existing audit
history retains the event detail. Existing cancellation eligibility is not
relaxed to introduce a new completed-booking refund API.

There is no payout, bank call, paid transition, or settlement reversal here.
Generation makes no provider calls. Existing financial-provider behavior is
unchanged except for locking and review integration.

### Isolated concurrency validation

Run `scripts/vendor-settlement-concurrency.integration.js` with
`SETTLEMENT_MYSQL_TEST=1` only in the verified local development environment.
It checks the intended source fingerprint, copies **schema only** to a uniquely
named task-created database, and runs isolated fixtures. It never runs Prisma
migrations or copies source business data. Provider transports are stubbed and
network fetch is forbidden. It checks identical-key/different-key races and
both orderings of generation versus refund/reconciliation, then drops only
its own database. Jest uses the existing in-memory mock and is not concurrency
proof. Fresh-bootstrap/BOM debt is untouched and separate.
