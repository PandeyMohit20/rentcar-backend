'use strict';

const { hasCapturedMoney, selectAuthoritativePayment } = require('../payments/recovery');
const missing = (value) => value === null || value === undefined;

// Exact two-decimal strings at the API boundary; no binary floating-point summation.
function minor(value) {
  if (missing(value) || !/^-?\d+(\.\d{1,2})?$/.test(String(value))) return null;
  const [whole, fraction = ''] = String(value).replace(/^-/, '').split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (String(value).startsWith('-') ? -1n : 1n);
}
function money(value) {
  if (missing(value)) return null;
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function subtractMinor(left, right) {
  return left - right;
}

function evaluateSettlementEligibility({ booking: b, payments = [], refunds = [], items = [], audits = [], evidenceTruncated = false, trips = [] }, vendorId) {
  const blockers = [];
  const block = (code, message) => { if (!blockers.some((x) => x.code === code)) blockers.push({ code, message }); };
  if (b.vendorId !== vendorId) block('VENDOR_MISMATCH', 'Booking does not belong to this vendor.');
  if (b.status !== 'COMPLETED') block('BOOKING_NOT_COMPLETED', 'Booking must be completed.');
  const fields = { rentalSubtotal: b.subtotal, tax: b.tax, securityDeposit: b.securityDeposit,
    commissionRateSnapshot: b.vendorCommissionRate, commissionAmountSnapshot: b.vendorCommision };
  const financialFacts = {};
  for (const [key, value] of Object.entries(fields)) {
    const parsed = minor(value);
    financialFacts[key] = money(parsed);
    if (missing(parsed) || parsed < 0n) block(
      key.startsWith('commission') ? 'COMMISSION_SNAPSHOT_INVALID' : 'BOOKING_FINANCIAL_FACT_INVALID',
      key.startsWith('commission') ? 'Commission snapshots must be present and valid.' : 'Booking financial facts are incomplete or invalid.');
  }
  if (minor(b.vendorCommissionRate) > 10000n) block('COMMISSION_SNAPSHOT_INVALID', 'Commission rate snapshot is invalid.');
  if (minor(b.discount) !== 0n) block('DISCOUNT_INTERPRETATION_REQUIRED', 'Historical discount interpretation requires review; commission is unchanged.');
  if (!/^[A-Z]{3}$/.test(b.currencyCode || '')) block('CURRENCY_INVALID', 'Booking currency is invalid.');

  const p = selectAuthoritativePayment(payments);
  const captures = payments.filter(hasCapturedMoney);
  if (captures.length > 1) block('MULTIPLE_CAPTURED_PAYMENTS', 'Multiple capture-bearing attempts require review.');
  if (payments.some((x) => x.operationalStatus === 'review_required')) block('PAYMENT_REVIEW_REQUIRED', 'A payment attempt requires review.');
  if (payments.some((x) => x.operationalStatus === 'late_payment_conflict')) block('LATE_PAYMENT_CONFLICT', 'A payment attempt has a late capture conflict.');
  let gross = null;
  if (!p || !hasCapturedMoney(p)) block('CAPTURED_PAYMENT_MISSING', 'No authoritative captured payment is available.');
  else {
    gross = minor(p.amount);
    if (!['succeeded', 'refunded'].includes(p.status) || !p.providerPaymentId || !p.paidAt
      || !Number.isFinite(new Date(p.paidAt).getTime()) || p.operationalStatus !== 'normal') {
      block('PAYMENT_CAPTURE_EVIDENCE_INCOMPLETE', 'Normal captured payment evidence is incomplete.');
    }
    if (p.bookingId !== b.id || !p.userId || p.userId !== b.userId) block('PAYMENT_ASSOCIATION_MISMATCH', 'Payment association does not match booking.');
    if (missing(gross) || gross <= 0n || gross !== minor(b.totalAmount)) block('PAYMENT_AMOUNT_MISMATCH', 'Captured amount does not match the trusted booking total.');
    if (p.currencyCode !== b.currencyCode) block('PAYMENT_CURRENCY_MISMATCH', 'Payment and booking currencies differ.');
  }
  const selectedRefunds = p ? refunds.filter((r) => r.paymentId === p.id) : [];
  let refunded = 0n;
  let validRefunds = true;
  for (const r of selectedRefunds) {
    const amount = minor(r.amount);
    if (r.bookingId !== b.id || r.paymentId !== p.id || r.currencyCode !== p.currencyCode || missing(amount) || amount <= 0n) {
      validRefunds = false;
      block('REFUND_FACTS_INVALID', 'Refund association, currency or amount is invalid.');
    }
    if (r.status === 'succeeded' && !missing(amount)) refunded += amount;
  }
  const unresolved = selectedRefunds.filter((r) => ['pending', 'processing'].includes(r.status));
  if (unresolved.length) block('REFUND_UNRESOLVED', 'Refund processing is unresolved.');
  if (!validRefunds) refunded = null;
  const remaining = !missing(gross) && !missing(refunded)
    ? subtractMinor(gross, refunded)
    : null;
  if (!missing(remaining) && remaining < 0n) block('REFUND_TOTAL_IMPOSSIBLE', 'Successful refunds exceed the captured amount.');
  if (p?.status === 'refunded' && (!refunded || refunded < 0n)) block('REFUND_EVIDENCE_INCOMPLETE', 'Refunded payment has no valid successful refund evidence.');

  for (const audit of audits) {
    let metadata;
    try { metadata = typeof audit.metadata === 'string' ? JSON.parse(audit.metadata) : audit.metadata; } catch (_) { metadata = null; }
    if (!metadata || !['reconciled', 'already_settled', 'pending', 'failed'].includes(audit.result)
      || metadata.code || metadata.capturedPaymentIds?.length > 1) {
      block('RECONCILIATION_REVIEW_REQUIRED', 'Reconciliation evidence has no explicit resolution; operator review is required.');
    }
  }
  if (evidenceTruncated) block('RECONCILIATION_EVIDENCE_INCOMPLETE', 'Reconciliation history exceeds the preview evidence limit.');
  const exact = items.find((x) => x.bookingId === b.id && x.paymentId === p?.id);
  if (exact) block('ALREADY_SETTLED', 'Booking/payment pair already belongs to a settlement.');
  if (items.some((x) => x.bookingId === b.id && x.paymentId !== p?.id)) block('BOOKING_SETTLED_OTHER_PAYMENT', 'Booking belongs to a settlement under another payment.');
  const eligibleForReview = blockers.length === 0;
  for (const issue of require('./settlementPolicy').policyBlockers(b, trips, refunds, p)) block(issue.code, issue.message);
  const generationReady = blockers.length === 0;
  const netPayable = generationReady ? money(minor(b.subtotal) + minor(b.tax) - minor(b.vendorCommision)) : null;
  return {
    bookingId: b.id, bookingNumber: b.bookingNumber, status: b.status, currencyCode: b.currencyCode,
    financialFacts: { ...financialFacts, grossCaptured: money(gross), successfulRefunded: money(p ? refunded : null), remainingCaptured: money(remaining) },
    payment: p ? { paymentId: p.id, status: p.status, operationalStatus: p.operationalStatus, currencyCode: p.currencyCode } : null,
    refunds: { successfulAmount: money(p ? refunded : null), unresolvedCount: unresolved.length, unresolvedStatuses: [...new Set(unresolved.map((r) => r.status))].sort() },
    settlementState: { alreadySettled: items.length > 0, existingSettlementId: exact?.settlementId || items[0]?.settlementId || null },
    eligibleForReview, generationReady, netPayable, blockers,
  };
}

function summarizePreview(rows) {
  const groups = new Map();
  const fields = ['grossCaptured', 'successfulRefunded', 'remainingCaptured', 'rentalSubtotal', 'tax', 'securityDeposit', 'commissionAmountSnapshot'];
  for (const row of rows) {
    if (!groups.has(row.currencyCode)) groups.set(row.currencyCode, {
      currencyCode: row.currencyCode, bookingCount: 0, includedBookingCount: 0, excludedBookingCount: 0,
      totals: Object.fromEntries(fields.map((key) => [key, 0n])),
    });
    const group = groups.get(row.currencyCode);
    group.bookingCount++;
    if (!row.eligibleForReview) { group.excludedBookingCount++; continue; }
    group.includedBookingCount++;
    for (const key of fields) group.totals[key] += minor(row.financialFacts[key]);
  }
  return [...groups.values()].map((group) => ({ ...group, totals: Object.fromEntries(
    Object.entries(group.totals).map(([key, value]) => [key, money(value)])),
  }));
}

module.exports = { evaluateSettlementEligibility, summarizePreview };
