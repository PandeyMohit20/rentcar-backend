# PHASE 7 — TAX + INVOICE + EMAIL

PASS below means implementation/automated validation; it does not mean approved
legal policy or live inbox delivery. Live email/PDF UAT was NOT_RUN. No real
emails or new customer bookings were created during Phase 7.

| Check | Result |
|---|---|
| TAX ENGINE | PASS |
| Server-authoritative | YES |
| CGST/SGST support | PASS for supported, approved state-based policy |
| IGST support | PASS |
| Tax policy confirmed | BUSINESS_CONFIRMATION_REQUIRED |
| Trusted quote tax integrity | PASS |
| Booking financial snapshot | PASS |
| Razorpay amount consistency | PASS |
| INVOICE | PASS for new configured snapshots; legacy JSON reads preserved |
| Exactly one invoice | PASS |
| Tax breakdown | PASS |
| PDF | PASS with approved fixture; rendered and visually inspected |
| Customer invoice authorization | PASS |
| EMAIL INFRASTRUCTURE | PASS; opt-in worker, disabled by default |
| Booking created | PASS automated |
| Payment failed | PASS automated |
| Payment + booking confirmed | PASS automated; consolidated email |
| Invoice PDF attachment | PASS automated |
| Booking cancelled | PASS automated |
| Refund initiated wording | PASS |
| Refund succeeded | PASS automated; verified webhook prerequisite |
| Refund failed | PASS automated; verified webhook prerequisite |
| Email idempotency | PASS |
| Email retry safety | PASS; ambiguous sends quarantined, not blindly retried |
| Duplicate webhook email protection | PASS |
| FRONTEND | PASS automated; live Phase 7 UI UAT pending |
| ADMIN | PASS automated; live Phase 7 UI UAT pending |
| BACKEND TESTS | 306 passed / 0 failed; 51 suites; 107.338 seconds |
| FRONTEND BUILD | PASS |
| FRONTEND LINT | PASS; 0 errors / 33 existing warnings |
| ADMIN BUILD | PASS |
| ADMIN LINT | PASS; 0 errors / 0 warnings |
| SCHEMA CHANGED | YES |
| MIGRATION | YES; two additive migrations applied, Prisma client generated |
| CODE CHANGED | YES; backend, frontend and admin |
| PRODUCTION READY FOR TAX | NO |
| PRODUCTION READY FOR INVOICE | NO |
| PRODUCTION READY FOR TRANSACTIONAL EMAIL | NO |
| PHASE 7 HARD-CLOSE | NO |

## Real MySQL checks

- Payment recovery/order guards: 40 iterations (30 capture races, 10 claim-gap
  races); no duplicate provider orders, state corruption or cleanup failures.
- Capture versus cancellation: 100 iterations, 34 cancellation-first,
  33 capture-first, 33 simultaneous; zero deadlocks, retries, lost captures,
  duplicate refunds, confirmation resurrection or duplicate history.
- Paid double cancellation: 20 iterations; one durable refund identity per
  iteration, no duplicate financial/history states. 40 mocked transport calls
  reused the same effective refund identity per booking.
- Booking creation race: one success, one conflict, one booking.
- Email enqueue/claim race: 20 iterations; 20 fake sends, no duplicates,
  no real SMTP delivery.
- Invoice sequence: 20 concurrent allocations; unique consecutive numbers.

## Changes and findings

Central integer-paise tax calculation; signed tax/customer/billing context;
immutable booking and invoice JSON snapshots; financial-year invoice numbers;
server-generated PDFs; owner/admin-authorized downloads; safe email summaries;
SMTP templates, buffered PDF attachments, durable delivery projection and claims;
customer/admin tax and PDF presentation.

The number allocator's first-row race was reproduced against MySQL and fixed
using a native atomic upsert inside the financial transaction. A PDF alignment
defect was found during visual inspection and fixed. The test mock's increment
semantics were corrected to match Prisma.

Existing upload tests deleted development files during their cleanup. The tracked
files were restored; test storage and all corresponding file operations now use
isolated temporary directories. The original UAT customer's document files are
present. No tracked upload changes remain.

Nodemailer updated to 9.1.1; external file/URL attachment loading disabled.
The dependency audit still reports eight other backend advisories: five moderate,
two high, one critical. They were not bulk-upgraded as part of this phase.

An intermediate suite run encountered a temporary missing Nodemailer file while
the dependency was being replaced. The final run above used the settled install
and passed all suites. No intermediate failing run is counted as a pass.

Original payment UAT booking BK-E95A76B0F9E6454A remains CANCELLED/refunded:
INR 20,500, one payment, one successful refund, one issued invoice. Its invoice
has no historical tax snapshot, so its JSON remains readable and tax PDF export
returns INVOICE_HISTORICAL_SNAPSHOT_UNAVAILABLE. No tax data was backfilled.

## Remaining business configuration and UAT

1. Approved GST rate/classification/SAC, deposit treatment, place-of-supply rule,
   seller legal name/address/GSTIN/state, policy version and invoice numbering
   approval. TAX_POLICY_REQUIRES_BUSINESS_CONFIRMATION is still active.
2. Authoritative default billing state as a GST code when using billing-address
   place of supply. Unsupported treatments such as UTGST/cess/reverse charge need
   a separately approved extension; they are not silently approximated.
3. Designated test recipient, explicit non-production allowlist and worker start
   timestamp. SMTP credentials are present but no live email test was sent.
4. One controlled, sequential booking/capture/invoice/cancellation/refund email
   UAT with inbox and PDF attachment inspection; worker supervised in deployment.
5. Review remaining dependency advisories before production sign-off.

SMTP acceptance is recorded as accepted, not delivered-to-inbox. An uncertain
send requires provider-log review; generic SMTP cannot guarantee exactly-once
delivery across a crash after acceptance.

The earlier intentional failed-payment/retry UAT was not completed before the
Phase 7 request and is not marked passed by this report.

See [configuration and architecture](phase7-tax-invoice-email.md).
