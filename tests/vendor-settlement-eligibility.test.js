'use strict';

const { evaluateSettlementEligibility: evaluate, summarizePreview } = require('../src/modules/vendors/settlementEligibility');

function fixture() {
  return {
    booking: { id: 'b', vendorId: 'v', userId: 'u', bookingNumber: 'BK', status: 'COMPLETED', currencyCode: 'INR', subtotal: '100.00', tax: '18.00', securityDeposit: '50.00', totalAmount: '168.00', discount: '0.00', vendorCommissionRate: '10.00', vendorCommision: '10.00' },
    payments: [{ id: 'p', bookingId: 'b', userId: 'u', amount: '168.00', currencyCode: 'INR', status: 'succeeded', operationalStatus: 'normal', providerPaymentId: 'private-provider-id', paidAt: new Date(), createdAt: new Date() }],
    refunds: [], items: [], audits: [],
  };
}
const codes = (row) => row.blockers.map((b) => b.code);
const refund = (amount, status = 'succeeded') => ({ paymentId: 'p', bookingId: 'b', currencyCode: 'INR', amount, status });

describe('read-only settlement eligibility', () => {
  it('returns exact snapshot facts with tax and deposit separate, without a payable', () => {
    const result = evaluate(fixture(), 'v');
    expect(result.financialFacts).toEqual({ rentalSubtotal: '100.00', tax: '18.00', securityDeposit: '50.00', grossCaptured: '168.00', successfulRefunded: '0.00', remainingCaptured: '168.00', commissionRateSnapshot: '10.00', commissionAmountSnapshot: '10.00' });
    expect(result).toMatchObject({ eligibleForReview: true, generationReady: false, netPayable: null });
    expect(codes(result)).toEqual(expect.arrayContaining(['COMPLETION_EVIDENCE_INVALID', 'FINANCIAL_SNAPSHOT_UNSUPPORTED']));
    expect(codes(result)).not.toContain('GENERATION_POLICY_NOT_APPROVED');
    expect(JSON.stringify(result)).not.toContain('private-provider-id');
  });
  it.each(['ACTIVE', 'CANCELLED'])('excludes %s bookings', (status) => {
    const f = fixture(); f.booking.status = status;
    expect(codes(evaluate(f, 'v'))).toContain('BOOKING_NOT_COMPLETED');
  });
  it('uses the recovery selector instead of a newer pending attempt', () => {
    const f = fixture(); f.payments.push({ ...f.payments[0], id: 'new', status: 'pending', paidAt: null, providerPaymentId: null, createdAt: new Date(Date.now() + 10000) });
    expect(evaluate(f, 'v').payment.paymentId).toBe('p');
  });
  it('keeps a capture conflict authoritative even alongside a normal success', () => {
    const f = fixture(); f.payments.push({ ...f.payments[0], id: 'conflict', operationalStatus: 'review_required' });
    const result = evaluate(f, 'v');
    expect(result.payment.paymentId).toBe('conflict');
    expect(codes(result)).toEqual(expect.arrayContaining(['MULTIPLE_CAPTURED_PAYMENTS', 'PAYMENT_REVIEW_REQUIRED']));
    expect(result.eligibleForReview).toBe(false);
  });
  it.each([['review_required', 'PAYMENT_REVIEW_REQUIRED'], ['late_payment_conflict', 'LATE_PAYMENT_CONFLICT']])('blocks %s on any attempt', (operationalStatus, code) => {
    const f = fixture(); f.payments.push({ ...f.payments[0], id: 'other', status: 'failed', paidAt: null, providerPaymentId: null, operationalStatus });
    expect(codes(evaluate(f, 'v'))).toContain(code);
  });
  it('detects multiple captures using capture evidence even with a failed status', () => {
    const f = fixture(); f.payments.push({ ...f.payments[0], id: 'other', status: 'failed' });
    expect(codes(evaluate(f, 'v'))).toContain('MULTIPLE_CAPTURED_PAYMENTS');
  });
  it('sums multiple partial refunds exactly without changing commission or inferring full refund', () => {
    const f = fixture(); f.payments[0].status = 'refunded'; f.refunds = [refund('0.10'), refund('0.20'), refund('20.00', 'failed')];
    expect(evaluate(f, 'v').financialFacts).toMatchObject({ successfulRefunded: '0.30', remainingCaptured: '167.70', commissionAmountSnapshot: '10.00' });
  });
  it.each(['pending', 'processing'])('exposes unresolved %s refunds', (status) => {
    const f = fixture(); f.refunds = [refund('10', status)];
    const result = evaluate(f, 'v');
    expect(result.refunds).toEqual({ successfulAmount: '0.00', unresolvedCount: 1, unresolvedStatuses: [status] });
    expect(codes(result)).toContain('REFUND_UNRESOLVED');
  });
  it('blocks impossible refunds without clamping negative remaining capture', () => {
    const f = fixture(); f.refunds = [refund('200')];
    const result = evaluate(f, 'v');
    expect(result.financialFacts.remainingCaptured).toBe('-32.00');
    expect(codes(result)).toContain('REFUND_TOTAL_IMPOSSIBLE');
    expect(summarizePreview([result])[0].excludedBookingCount).toBe(1);
  });
  it.each([{ bookingId: 'other' }, { currencyCode: 'USD' }, { amount: '-1' }])('blocks inconsistent refund facts %j', (changes) => {
    const f = fixture(); f.refunds = [{ ...refund('10'), ...changes }];
    const result = evaluate(f, 'v');
    expect(codes(result)).toContain('REFUND_FACTS_INVALID');
    expect(result.financialFacts.successfulRefunded).toBeNull();
  });
  it.each([
    [{ currencyCode: 'USD' }, 'PAYMENT_CURRENCY_MISMATCH'],
    [{ bookingId: 'wrong' }, 'PAYMENT_ASSOCIATION_MISMATCH'],
    [{ userId: 'wrong' }, 'PAYMENT_ASSOCIATION_MISMATCH'],
    [{ amount: '1' }, 'PAYMENT_AMOUNT_MISMATCH'],
    [{ providerPaymentId: null }, 'PAYMENT_CAPTURE_EVIDENCE_INCOMPLETE'],
    [{ paidAt: null }, 'PAYMENT_CAPTURE_EVIDENCE_INCOMPLETE'],
  ])('blocks inconsistent payment facts %j', (changes, code) => {
    const f = fixture(); Object.assign(f.payments[0], changes);
    expect(codes(evaluate(f, 'v'))).toContain(code);
  });
  it.each(['vendorCommissionRate', 'vendorCommision'])('blocks missing %s', (field) => {
    const f = fixture(); f.booking[field] = null;
    expect(codes(evaluate(f, 'v'))).toContain('COMMISSION_SNAPSHOT_INVALID');
  });
  it('accepts zero commission and preserves an unrecalculated stored amount', () => {
    const f = fixture(); f.booking.vendorCommision = '0.00';
    expect(evaluate(f, 'v')).toMatchObject({ eligibleForReview: true, financialFacts: { commissionAmountSnapshot: '0.00' } });
    f.booking.vendorCommision = '9.99';
    expect(evaluate(f, 'v').financialFacts.commissionAmountSnapshot).toBe('9.99');
  });
  it('blocks ambiguous discount without recalculation', () => {
    const f = fixture(); f.booking.discount = '10';
    const result = evaluate(f, 'v');
    expect(codes(result)).toContain('DISCOUNT_INTERPRETATION_REQUIRED');
    expect(result.financialFacts.commissionAmountSnapshot).toBe('10.00');
  });
  it.each([['p', 'ALREADY_SETTLED'], ['other', 'BOOKING_SETTLED_OTHER_PAYMENT']])('excludes existing settlement payment %s', (paymentId, code) => {
    const f = fixture(); f.items = [{ bookingId: 'b', paymentId, settlementId: 's' }];
    const result = evaluate(f, 'v');
    expect(result.settlementState).toEqual({ alreadySettled: true, existingSettlementId: 's' });
    expect(codes(result)).toContain(code);
  });
  it.each(['requires_review', 'review_required', 'rejected', 'fetch_started', 'error'])('blocks unresolved audit result %s', (result) => {
    const f = fixture(); f.audits = [{ result, metadata: '{}' }, { result: 'reconciled', metadata: '{}' }];
    expect(codes(evaluate(f, 'v'))).toContain('RECONCILIATION_REVIEW_REQUIRED');
  });
  it('detects audit-only multiple captures and incomplete history', () => {
    const f = fixture(); f.audits = [{ result: 'reconciled', metadata: JSON.stringify({ capturedPaymentIds: ['private1', 'private2'] }) }]; f.evidenceTruncated = true;
    const result = evaluate(f, 'v');
    expect(codes(result)).toEqual(expect.arrayContaining(['RECONCILIATION_REVIEW_REQUIRED', 'RECONCILIATION_EVIDENCE_INCOMPLETE']));
    expect(JSON.stringify(result)).not.toContain('private1');
  });
  it('does not mix currencies and excludes unsafe rows from page totals', () => {
    const f = fixture(); const a = evaluate(f, 'v');
    f.booking.currencyCode = 'USD'; f.payments[0].currencyCode = 'USD'; const b = evaluate(f, 'v');
    f.payments[0].currencyCode = 'INR'; const bad = evaluate(f, 'v');
    const summary = summarizePreview([a, b, bad]);
    expect(summary).toHaveLength(2);
    expect(summary[0].totals.grossCaptured).toBe('168.00');
    expect(summary[1]).toMatchObject({ bookingCount: 2, includedBookingCount: 1, excludedBookingCount: 1, totals: { grossCaptured: '168.00' } });
  });
  it('does not mutate its inputs', () => {
    const f = fixture(); const before = JSON.stringify(f); evaluate(f, 'v');
    expect(JSON.stringify(f)).toBe(before);
  });
});
