# Phase 7 — tax, invoice and transactional email

## Audit and activation

The original implementation charged rental plus deposit, signed those amounts,
stored scalar booking/invoice tax, and issued one invoice per captured booking.
It had no GST engine, PDF generator, immutable billing identity, or lifecycle
email queue. Nodemailer already handled authentication messages via SMTP.

`TAX_POLICY_REQUIRES_BUSINESS_CONFIRMATION` remains the activation blocker.
No GST rate, SAC, seller identity, address or legal treatment is inferred from
the software tests. Their fixtures are **not business configuration**.
New production quotes fail closed without an approved vendor policy. Development
quotes retain the old rental-plus-deposit amount, explicitly flag unconfirmed tax,
and cannot produce a tax invoice PDF. Existing invoices are never backfilled with
current seller/tax details: absent historical snapshots block PDF generation.

The additive migrations add vendor tax configuration, booking financial/billing
JSON snapshots, invoice JSON snapshots, a durable email delivery table, and a fiscal-year invoice sequence. Configured tax invoices use a consecutive system-wide RC financial-year series, at most 16 characters; approve this numbering series as part of business rollout. Historical numbers remain unchanged.
Apply with `npx prisma migrate deploy`, then `npx prisma generate`.

## Approved policy

Each vendor needs a JSON object validated by `pricing/tax.js`:

- `approved`: true, only after actual business approval
- `version`: immutable approval reference/version
- `vehicleRates`: explicit approved GST basis points and cess basis points for each vehicle/category; no universal fallback
- `sellerState`: two-digit GST state code matching the GSTIN
- `placeOfSupplyRule`: `seller_state` or `billing_address_state`, selected only
  where the business has approved that rule for its classified service
- `depositTreatment`: `refundable_not_consideration`
- `legalName`, `address`, `gstin`, `sac`; optional `supportEmail`

Install an approved file using
`node scripts/configure-tax-policy.js VENDOR_ID APPROVED_POLICY_JSON`.
This is an operator configuration command, not a public API. Do not use it to
manufacture UAT financial state. Changing policy affects new quotes only.
For an address on record the authoritative default address `state` must
contain the GST state code; a missing/unrecognized code blocks the quote.
Customer GSTIN and other place-of-supply rules are not currently supported.
Unsupported classifications, UTGST, cess, reverse charge, inclusive prices,
and applied/forfeited deposits require separate business-approved extensions.

Rental and configured additional charges are taxable; a refundable deposit is
shown separately and excluded only under the explicitly approved deposit policy.
No deposit-forfeiture policy is introduced. See CGST Act section 2(31) and IGST
Act sections 7/8/12; the correct rate and classification remain business inputs.

All arithmetic uses integer paise. Tax components use half-up rounding;
intrastate CGST/SGST are rounded separately and then summed. Signed quotes bind
financial components, policy version and authenticated customer. Booking and
invoice records copy snapshots and never recalculate historic tax. Razorpay
continues consuming the booking total, converted to paise by its existing guard.

## PDF and APIs

- `GET /api/v1/bookings/:bookingId/invoice` — owner-only JSON
- `GET /api/v1/bookings/:bookingId/invoice/download` — owner-only PDF
- `GET /api/v1/admin/bookings/:bookingId/invoice/download` — `bookings.view`
- `GET /api/v1/admin/bookings/:bookingId/emails` — safe delivery summaries,
  `bookings.view`

PDFs use stored seller/customer/vehicle and financial details. Current booking,
payment and refund state appear as annotations; historical invoice financials
remain unchanged. The original one-invoice and issued-after-refund policy remains.
Customer/vendor users cannot use admin PDF routes without admin booking permission.
No unauthenticated PDF URL or public file is created. Downloads use private/no-store.

## Transactional email worker

Reuse the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, `SMTP_FROM`. Never put real values in source control.

Additional operator environment:

- `TRANSACTIONAL_EMAIL_MODE=disabled` (default), `preview`, or `smtp`
- `TRANSACTIONAL_EMAIL_SINCE`: explicit ISO timestamp delimiting eligible bookings
- `TRANSACTIONAL_EMAIL_ALLOWLIST`: comma-separated designated recipients,
  **required outside production for SMTP**

Run `node scripts/transactional-email-worker.js` under a process supervisor, or
append `--once` for one reconciliation/delivery pass. Do not enable it against
historic real customers. Deployment must choose a start timestamp intentionally.
The worker is opt-in and is not automatically started by the API.

The worker projects committed booking history, payments, invoices and verified
refund events into unique event/entity/recipient delivery keys. It never makes
SMTP calls inside financial transactions. Re-scanning repairs a crash before
enqueue; database uniqueness and atomic claims prevent concurrent sends.
Repeated webhooks do not create new logical lifecycle emails.

Captured payment and booking confirmation use one consolidated email with the
invoice attached when ready. An invoice becoming available after the accepted
confirmation gets one separate invoice email. Cancellation says refund initiated;
refund-success/failure messages require the corresponding processed webhook row.
Provider terminal success alone does not generate a verified-webhook email.

`accepted` means SMTP/provider acceptance, **not inbox delivery**. Definitively
rejected sends retry with exponential backoff, at most five attempts. Ambiguous
timeouts and interrupted sends become `unknown` and require provider-log review;
they are never auto-retried. A deterministic Message-ID supports investigation
but is not claimed to provide SMTP deduplication. Preview never sends or marks
accepted. Blocked/unknown/failed states remain visible to administrators.

## UAT still required

Business-approved policy and seller profile; designated recipient and explicit
allowlist; a single controlled booking/payment/cancellation/refund lifecycle;
manual inbox/attachment inspection. Automated suites use fake SMTP only.
Do not reuse an old booking to manufacture new tax documents or notifications.
The earlier payment hard-close failure-checkout test remains incomplete.

## Validation notes

Regression exposed an existing upload-test cleanup defect: those tests deleted
files in the development upload directories. Tracked files were restored and
all upload storage paths now use an isolated temporary root in test mode.
The original UAT customer's referenced document files were verified present.

Nodemailer was updated from 9.0.5 to 9.1.1 within its existing major version to
resolve the email advisories reported by npm audit. File/URL attachment loading
is disabled; generated invoice attachments are buffers. Other pre-existing
backend dependency advisories remain outside this phase (npm audit reports
8: 5 moderate, 2 high, 1 critical).

Official references consulted for business-policy boundaries:
- [CBIC deposit/consideration guidance](https://cbic-gst.gov.in/sectoral-faq.html)
- [IGST Act](https://www.indiacode.nic.in/bitstream/123456789/2251/4/a2017-13.pdf)

## Phase 7B partial business approval update

DBRE India Pvt Ltd issuer identity and SAC 997311 are saved in the private inactive setting `billing.issuer.phase7b.pending`. Its partial approval status blocks new quotes; it is not an activated vendor tax profile. The old cancelled/refunded booking remains unchanged. No new migration.

Rental and additional charges classified as rental consideration are taxable. Genuine refundable deposits are excluded; later application requires the applicable charge policy. Support contacts are approved for omission. RC numbering is approved for UAT only.

Section 12(2) replaces the former selectable supplier/customer rule. A trusted active `billing.recipient.USER_ID` setting records registrationStatus and, for registered recipients, state/country. Unknown registration blocks rather than assuming unregistered. Unregistered recipients use their default address; only absence of an address permits supplier fallback. Incomplete/unsupported state codes block. Determination source and registration status are preserved in the signed financial snapshot. No recipient tax status has been invented for the UAT customer.

Vehicle rates support explicit vehicleId or categoryId selectors, with vehicle overrides taking priority. `vehicleCategoryAssignments` maps vehicle IDs to business-approved tax categories without a schema migration. The operator configuration validator accepts this structure. Nonzero cess remains fail-closed pending approval of its calculation basis and implementation; zero cess must also be explicit.

SMTP authentication and required TLS verification passed without sending. The designated allowlist is respected even in production when configured. Worker mode remains disabled and delivery rows remain zero. Synthetic PDF and email tests do not establish live inbox delivery.

Remaining business input: professional approval of vehicle/category GST and cess applicability/rates/basis, including confirmation of the commercial/legal structure. Source for Section 12: https://taxinformation.cbic.gov.in/content-page/explore-act/1000620/1000001
