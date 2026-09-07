'use strict';

// refunded is evidence of an earlier capture; paidAt/providerPaymentId are set
// by capture reconciliation, never checkout verification or authorization.
function hasCapturedMoney(payment) {
  return ['succeeded', 'refunded'].includes(payment.status) || Boolean(payment.paidAt || payment.providerPaymentId);
}
function priority(payment) {
  if (hasCapturedMoney(payment)) {
    if (['review_required', 'late_payment_conflict'].includes(payment.operationalStatus)) return 5;
    return payment.status === 'refunded' ? 3 : 4;
  }
  if (['pending', 'processing'].includes(payment.status)) return 2;
  return 1;
}
// Monetary truth precedes active attempts, which precede failed/cancelled history.
// Within each tier choose newest createdAt, then descending id for stable ties.
function selectAuthoritativePayment(payments) {
  return [...payments].sort((a, b) => priority(b) - priority(a)
    || new Date(b.createdAt) - new Date(a.createdAt)
    || b.id.localeCompare(a.id))[0] || null;
}
function customerPaymentSummary(payment) {
  if (!payment) return null;
  return { id: payment.id, status: payment.status, operationalStatus: payment.operationalStatus,
    amount: payment.amount, currencyCode: payment.currencyCode, createdAt: payment.createdAt, updatedAt: payment.updatedAt };
}
module.exports = { hasCapturedMoney, selectAuthoritativePayment, customerPaymentSummary };
