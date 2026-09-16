# Provider-authoritative payment recovery

## Customer API

`POST /api/v1/payments/:bookingId/reconcile` requires authentication, ownership of the internal booking ID, a UUID parameter and an empty JSON body. Frontend amounts, statuses and provider IDs are rejected. Existing webhook signature validation is unchanged.

The backend reads the stored Razorpay order/payment and payable amount. It fetches the provider order and bounded payment collection, then independently fetches the uniquely selected provider payment. A single captured attempt may coexist with earlier created/failed attempts. Multiple captured payments, competing authorized attempts, multiple local orders, truncated collections or unknown states require review.

All order/payment IDs, amounts (integer paise), currency and local customer/booking relationships must match. A provider payment already attached elsewhere cannot settle this booking. Provider reads have 10-second timeouts and credentials remain server-side. UAT_BYPASS bookings require the enabled non-production UAT flag and TEST credentials.

## Shared settlement and races

`payments/service.js::finalizeCapturedPayment` is shared by the verified capture webhook and reconciliation. Each caller acquires the same car row lock as its first transactional database operation before reading settlement state. The provider HTTP reads occur outside the transaction; local state is re-read under the lock afterward.

The shared path validates identity/money, guards other captures and booking conflicts, then updates payment, booking, history and receipt atomically. Existing unique provider order/payment/event IDs and invoice-per-booking constraints remain. Late capture conflicts retain money evidence and require review rather than falsely confirming a cancelled or conflicting booking. Refunded/settled states are not downgraded by late provider responses.

Webhook financial mismatch behavior remains review-required; reconciliation mismatches are rejected without financial changes and audited. Provider reconciliation is not recorded as a fabricated webhook event. Duplicate actual webhook event IDs retain existing handling; unrelated unique-key collisions are not misreported as a successfully handled duplicate event.

## Limits and audit

A database-backed audit claim under the car lock limits provider fetches to one per booking per 30 seconds, including across processes. Attempts, safe IDs, previous/provider/result states and outcomes use AuditLog (`payment.reconcile`, source `provider_reconciliation`). HTTP 429 carries Retry-After: 30. Already-settled requests return stored authoritative status without another provider lookup. Provider errors are sanitized and do not contain provider bodies or credentials.

## Customer recovery

Booking Status reads normal booking status first. The explicit `Check payment with provider` action requests reconciliation only if still unpaid, then refetches booking/payment/receipt state. It prevents concurrent clicks and adds a 30-second UI cooldown. Pending provider states display a processing message; they do not trigger another charge. No background provider polling was added.

## Background recovery

The repository has an email-specific worker, not a general payment scheduler. A future bounded worker can reuse this service's ownership/lookup/claim/settlement rules for recent stale pending orders, with a small batch and explicit operational configuration. No new scheduler framework is introduced here.

## Validation limits

Automated tests use isolated stores and provider doubles; they do not count as live UAT. Race tests cover a webhook arriving during provider fetch and concurrent finalization with the test store's transactions serialized to model MySQL row locks. Production coordination is SQL locking and unique constraints, not a JavaScript mutex. Live UAT uses only the previously captured TEST payment; no new booking, charge or refund is permitted. Genuine provider webhook replay remains separately dependent on provider delivery facilities.
