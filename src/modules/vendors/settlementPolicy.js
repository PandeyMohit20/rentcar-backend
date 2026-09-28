'use strict';

const minor = (value) => {
  if (value === null || value === undefined || !/^\d+(\.\d{1,2})?$/.test(String(value))) return null;
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const money = (value) => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
const validDate = (value) => value && Number.isFinite(new Date(value).getTime());

// Validate stored evidence, never current vendor tax/commission settings.
function policyBlockers(booking, trips, refunds, payment) {
  const blockers = [];
  const block = (code) => blockers.push({ code, message: code.replace(/_/g, ' ').toLowerCase() });
  if (booking.currencyCode !== 'INR') block('SETTLEMENT_CURRENCY_UNSUPPORTED');
  if (booking.paymentStatus !== 'succeeded' || payment?.status !== 'succeeded') block('PAYMENT_NOT_SUCCEEDED');
  if (refunds.length) block('REFUND_ACTIVITY_PRESENT');
  const trip = trips.length === 1 ? trips[0] : null;
  if (!trip || trip.bookingId !== booking.id || trip.tripStatus !== 'archived' ||
      !validDate(trip.startTime) || !validDate(trip.endTime) ||
      new Date(trip.endTime) < new Date(trip.startTime) || !trip.completedBy ||
      !Number.isInteger(trip.startOdometer) || !Number.isInteger(trip.endOdometer) ||
      trip.endOdometer < trip.startOdometer) block('COMPLETION_EVIDENCE_INVALID');
  const f = booking.financialSnapshot;
  const seller = booking.billingSnapshot?.seller;
  const subtotal = minor(booking.subtotal), tax = minor(booking.tax), deposit = minor(booking.securityDeposit);
  const commission = minor(booking.vendorCommision);
  let supported = subtotal !== null && tax !== null && deposit !== null &&
    !!f && f.version === 2 && f.policyStatus === 'confirmed' &&
    !f.taxMode && typeof f.policyVersion === 'string' && f.policyVersion.length > 0 &&
    f.currency === booking.currencyCode && minor(f.rentalSubtotal) === subtotal &&
    minor(f.tax?.totalTax) === tax && minor(f.securityDeposit) === deposit &&
    minor(f.grandTotal) === minor(booking.totalAmount) && minor(f.additionalCharges) === 0n &&
    minor(booking.discount) === 0n && f.depositTreatment === 'refundable_not_consideration' &&
    !!seller?.legalName && !!seller.address && seller.sellerState === f.sellerState &&
    /^(0[1-9]|[12][0-9]|3[0-8])$/.test(f.sellerState) &&
    seller.gstRegistrationStatus === f.gstRegistrationStatus;
  if (f?.gstRegistrationStatus === 'REGISTERED') {
    supported = supported && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(seller?.gstin || '') &&
      seller.gstin.slice(0, 2) === f.sellerState && /^\d{6}$/.test(seller.sac || '') &&
      ['IGST', 'CGST_SGST'].includes(f.tax?.type) && minor(f.taxableAmount) === subtotal &&
      minor(f.tax?.cgst) !== null && minor(f.tax?.sgst) !== null && minor(f.tax?.igst) !== null &&
      minor(f.tax.cgst) + minor(f.tax.sgst) + minor(f.tax.igst) === tax &&
      (!f.cess || minor(f.cess.totalCess) === 0n);
    const rate = minor(f.tax?.rate);
    if (supported) {
      const interstate = f.tax.type === 'IGST';
      const component = rate === null ? null : interstate
        ? (subtotal * rate + 5000n) / 10000n : (subtotal * rate + 10000n) / 20000n;
      supported = rate !== null && rate <= 10000n &&
        /^(0[1-9]|[12][0-9]|3[0-8])$/.test(f.sellerState) &&
        /^(0[1-9]|[12][0-9]|3[0-8])$/.test(f.placeOfSupplyState) &&
        (interstate ? f.sellerState !== f.placeOfSupplyState : f.sellerState === f.placeOfSupplyState) &&
        f.placeOfSupplyDetermination?.rule === 'igst_section_12_2' &&
        f.placeOfSupplyDetermination?.state === f.placeOfSupplyState &&
        minor(f.tax.igst) === (interstate ? component : 0n) &&
        minor(f.tax.cgst) === (interstate ? 0n : component) &&
        minor(f.tax.sgst) === (interstate ? 0n : component);
    }
  } else if (f?.gstRegistrationStatus === 'UNREGISTERED') {
    supported = supported && tax === 0n && f.tax?.type === 'NOT_COLLECTED' &&
      f.cess?.treatment === 'not_collected' && !seller?.gstin && seller?.documentApproved === true &&
      !!seller.documentApprovalReference && !!seller.documentTitle;
  } else supported = false;
  if (subtotal === null || tax === null || deposit === null ||
      subtotal + tax + deposit !== minor(booking.totalAmount)) supported = false;
  if (!supported) block('FINANCIAL_SNAPSHOT_UNSUPPORTED');
  if (commission !== null && subtotal !== null && commission > subtotal) block('COMMISSION_SNAPSHOT_INVALID');
  if (commission !== null && subtotal !== null && tax !== null && commission > subtotal + tax) block('NET_PAYABLE_INVALID');
  return blockers;
}

module.exports = { minor, money, policyBlockers };
