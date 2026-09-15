# Explicit seller GST registration policy

## Decision boundary

**READY FOR GST REGISTRATION STATUS DECISION.** This implementation does not decide whether CaronRent is registered, who its legal seller is, or which business taxes apply. No live registration, issuer identity, GSTIN, rate, CESS decision or approval was changed. No live bookings or payments were created.

The former DBRE issuer information comes from the private global `billing.issuer.phase7b.pending` Setting described in the previous configuration work. It is not a hardcoded identity in the calculation/PDF code. Actual quote invoice identity comes from `Vendor.taxProfile`. Previously `billingSnapshot` could also fall back to `Vendor.gstin`; that fallback has been removed. The pending Setting is not automatically copied into a vendor policy. Using the same legal identity as DBRE requires an explicit approved vendor policy.

## Storage and compatibility

- No SQL migration or Prisma column changes. `Vendor.taxProfile` already stores JSON. `Booking.financialSnapshot`, `Booking.billingSnapshot`, `Invoice.snapshot`, `Setting.value` and `AuditLog.metadata` already persist the required immutable information.
- New policy input requires `gstRegistrationStatus: REGISTERED | UNREGISTERED`. Status is never inferred from GSTIN presence/absence. The existing `sellerState` field remains the seller state code (the conceptual `sellerStateCode`); optional `state` holds an approved human-readable state label. No duplicate code field is introduced.
- Financial snapshots now use version 2 and carry explicit seller registration. Unregistered tax has `type: NOT_COLLECTED` and internal `totalTax: 0` for existing booking/payment arithmetic; it has **no percentage or CGST/SGST/IGST calculation fields**. This is distinct from a registered zero-rate snapshot.
- Historical version-1 confirmed invoice snapshots retain the old registered rendering contract. They are not rewritten or reclassified based on a missing GSTIN. Their previous GSTIN/identity requirements still apply.
- Existing policies lacking explicit status require administrator review before new quotes. This is a deliberate fail-closed input change; there is no silent data migration. Already-created bookings, amounts and invoices remain immutable. Legacy confirmed quotes without explicit status require regeneration before creating a new booking.
- Registered GST splitting/rounding, Section 12(2) recipient logic, deposit treatment, and the existing nonzero-CESS restriction are preserved.

## Conditional schema

Authoritative implementation: `src/modules/pricing/taxPolicy.js`. Unknown fields are rejected by the strict policy schemas.

| Field | Both / REGISTERED / UNREGISTERED | Requirement |
| --- | --- | --- |
| gstRegistrationStatus | Both | Explicit REGISTERED or UNREGISTERED; no default |
| approved | Both | Explicit true from approved business policy |
| version | Both | Nonblank approved revision, max 80 characters; status changes require a different version |
| legalName / address | Both | Approved issuer identity; nonblank, max 255 / 1500 characters |
| sellerState | Both | Two-digit state code 01–38 |
| state | Both | Optional approved state label, max 100 characters |
| supportEmail / supportPhone | Both | Optional approved contacts; valid email / supported phone shape |
| depositTreatment | Both | Explicit supported `refundable_not_consideration` |
| gstin | REGISTERED | Required existing GSTIN format; prefix must match sellerState |
| gstin | UNREGISTERED | Absent or null only; retained historical/other issuer GSTIN rejected |
| sac | REGISTERED | Required six-digit approved service classification |
| sac | UNREGISTERED | Optional six-digit approved service classification; business decides whether required for its document |
| placeOfSupplyRule | REGISTERED | Explicit `igst_section_12_2`; existing recipient registration/address logic retained |
| placeOfSupplyRule | UNREGISTERED | Explicit `not_applicable`; no GST place-of-supply calculation is performed |
| vehicleRates | Both | At least one explicit decision; all vendor cars must resolve via vehicle override or approved category assignment |
| vehicleRates[].vehicleId / categoryId | Both | Exactly one selector; vehicle ownership validated; duplicates rejected |
| vehicleRates[].approved | Both | Explicit true |
| vehicleRates[].gstRateBps | REGISTERED | Explicit integer 0–10000; registered zero is a real approved rate, not unregistered status |
| vehicleRates[].cessRateBps | REGISTERED | Explicit integer 0–10000; nonzero remains blocked pending approved calculation/invoice implementation |
| vehicleRates[].gstCollection | UNREGISTERED | Explicit `not_collected`; numeric gstRateBps is not accepted |
| vehicleRates[].cessTreatment | UNREGISTERED | Explicit `not_collected`; numeric cessRateBps is not accepted |
| unregisteredPolicyConfirmed | UNREGISTERED | Explicit true for the business-approved unregistered treatment |
| documentTitle | UNREGISTERED | Business-approved nonblank title, max 80 characters; cannot claim GST / tax-invoice status |
| documentApproved | UNREGISTERED | Explicit true |
| documentApprovalReference | UNREGISTERED | Nonblank business/legal document decision reference, max 500 characters |
| vehicleCategoryAssignments | Both | Optional mapping of this vendor's car IDs to approved category keys |

The only supported unregistered CESS treatment is explicitly approved non-collection. This is not an assertion that every unregistered business has that treatment. If another CESS basis, charge, document model, or mandatory legal field is required, do not substitute zero or invent wording: retain the configuration blocker and implement the separately approved requirement. The application supplies no default unregistered document title.

## Admin workflow

1. SUPER_ADMIN opens `/pricing/approvals` and reviews the existing issuer, vendor/fleet/pricing scope and audit history.
2. Explicitly select **Registered** or **Unregistered**. Selection does not copy or convert the stored policy. Registered shows a required approved GSTIN input. Unregistered hides it, displays the no-GST-collection warning, and requires deliberate clearing of any previously entered GSTIN from the draft.
3. Enter the complete approved policy JSON using the conditional schema above. The selected status and GSTIN controls are merged only after consistency checks: conflicting JSON is rejected, not rewritten silently. No rate or approval value is auto-filled. Unregistered policy/document approval must be provided explicitly.
4. Enter the policy approval reference and confirm the documented decisions. The save dialog displays the entire proposed policy and **old → new registration status**. `PUT /admin/billing-approval/vendors/:vendorId/tax-profile` uses existing DB-backed SUPER_ADMIN authorization.
5. A save reopens the global pending gate, preserves the prior receipt/audit history, updates the profile, and writes an audit in the same serializable transaction. This also supports a deliberate registration change after prior completion. Registration changes require a new policy version. Stale review or failed audit rolls back the write.
6. Review again, resolve readiness blockers, supply commercial/GST-or-noncollection, CESS and structure references, and check all final confirmations. The existing **Complete Pricing Approval** dialog/API performs final approval. An old completion key cannot reapprove a changed scope.
7. The old `scripts/configure-tax-policy.js` direct DB writer is retired and exits without writing. Use the authenticated UI/API so actor, old/new status and renewed approval cannot be bypassed by that tool.

## Readiness and audit

Readiness remains read-only. Unknown status yields `GST_REGISTRATION_STATUS_REQUIRED`. REGISTERED without GSTIN yields `MISSING_GSTIN`; its GST/ CESS decisions remain required. UNREGISTERED without GSTIN does **not** receive MISSING_GSTIN; it requires explicit unregistered confirmation and per-vehicle noncollection decisions. Invalid/missing document approval is rejected by the conditional policy schema. Technical blockers plus final confirmations must all be resolved before READY.

Audit records retain actor, timestamp, old/new registration status, policy version, approval reference, old/new profile hashes and the reviewed configuration hash. Setting changes are compare-and-swap protected inside the same transaction. Financial and billing snapshots carry the decision into bookings/invoices. New bookings reject quotes with an incompatible current seller status or while global pricing approval has reopened. Existing paid bookings and historical invoices retain their original snapshots.

## Quote, payment, document and refund behavior

- REGISTERED: existing GST calculation is retained. UNREGISTERED: rental plus legitimate additional charges plus the existing refundable deposit; no GST is added or hidden in base rates.
- Quotes retain the signed trusted financial snapshot. Booking amount comes from the quote; payment orders convert the stored booking total to minor units. Capture reconciliation checks the amount/currency. Invoice total is the booking total. No frontend tax arithmetic was introduced.
- Unregistered PDFs use the approved document title, seller/customer/booking/payment details, rental/other charges, deposit and total. They omit GSTIN, GST collection lines and taxable-value presentation. PDF validation rejects contradictory registered/unregistered snapshots and missing document approval. Registered/historical PDF validation remains intact.
- Customer quote, booking and invoice views show “GST is not charged by the seller.” for UNREGISTERED, instead of fake zero GST lines. Customer pricing errors use a friendly unavailable message; original backend error codes remain in the service error data for diagnostics. Invoice-download blockers are no longer shown as raw codes to customers.
- Existing cancellation currently permits eligible pre-trip paid cancellations with a full refund of the captured payment. It does not calculate a separate GST adjustment or cancellation tax. Unregistered refund tests verify that same captured amount. No new fee/refund policy was invented.

## Required business decisions before live UAT

- Actual legal issuer and whether it is REGISTERED or UNREGISTERED.
- Approved issuer identity, state and contacts; GSTIN only if registered.
- Registered vehicle/category GST and explicit CESS decisions, or a supported explicitly approved unregistered noncollection policy.
- Unregistered document title, classification/mandatory content and approval reference. No legal wording is supplied by this implementation.
- Current commercial prices, effective dates, fresh policy version and final approval references.

Live data must remain unchanged until the authorized SUPER_ADMIN makes these decisions. Code tests and local browser fixtures are not live approval or payment evidence.
