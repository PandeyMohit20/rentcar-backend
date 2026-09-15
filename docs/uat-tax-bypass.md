# Local tax approval bypass

Opt in only with `BYPASS_TAX_APPROVAL_FOR_UAT=true` and `NODE_ENV` other than `production`. Default is disabled. Production ignores the flag; previously signed UAT quotes are rejected and UAT receipt generation is blocked. Set the flag to `false` and restart to restore normal local approval gating.

This mode does not constitute business approval. Readiness and the SUPER_ADMIN approval page continue reporting the actual stored policy and blockers. No vendor policies, approval settings, commercial prices or approval audits are written by the bypass.

UAT snapshots carry `taxMode: UAT_BYPASS`, `policyStatus: uat_bypass`, null registration status, and zero collected GST/CESS without numerical tax-rate fields. Commercial pricing, availability, authentication, quote expiry, booking holds and idempotency remain enforced. Payment order creation for these bookings additionally requires a Razorpay test key. Existing payment verification and amount checks remain in force.

Generated documents are explicitly titled UAT Receipt, omit GSTIN/tax lines, and state that no business tax approval was recorded. They do not consume the approved tax invoice number sequence.

Automated tests use isolated test stores/providers; only the separate HTTP quote retry is live evidence. No booking or payment should be reported as live-tested from these tests.
