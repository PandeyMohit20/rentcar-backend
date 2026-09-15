'use strict';

const AppError = require('../../errors/AppError');
const { state, policySchema, vehicleProfileSchema, selectVehiclePolicy } = require('./taxPolicy');
function determinePlaceOfSupply({ sellerState, recipient }) {
  if (!recipient || !['registered', 'unregistered'].includes(recipient.registrationStatus))
    throw blocked('RECIPIENT_TAX_STATUS_REQUIRED');
  const registered = recipient.registrationStatus === 'registered';
  const source = registered
    ? 'registered_recipient_location'
    : recipient.hasAddressOnRecord
      ? 'recipient_address_on_record'
      : 'supplier_location';
  const location = source === 'supplier_location' ? sellerState : recipient.state;
  if (!state.safeParse(location).success) throw blocked('CUSTOMER_BILLING_STATE_REQUIRED');
  if (recipient.country && !['IN', 'India'].includes(recipient.country))
    throw blocked('DOMESTIC_PLACE_OF_SUPPLY_REQUIRED');
  return {
    rule: 'igst_section_12_2',
    registrationStatus: recipient.registrationStatus,
    source,
    state: location,
  };
}
function blocked(code) {
  return new AppError(code, 409, code);
}
function paise(value) {
  const m = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw blocked('INVALID_MONEY');
  const n = BigInt(m[1]) * 100n + BigInt((m[2] || '').padEnd(2, '0'));
  if (n > 999999999999n) throw blocked('AMOUNT_OUT_OF_RANGE');
  return n;
}
const major = (n) => Number(n) / 100;
function calculateTax({
  rentalSubtotal,
  securityDeposit,
  additionalCharges = 0,
  currency = 'INR',
  policy,
  recipient,
  uatBypass = false,
}) {
  const rent = paise(rentalSubtotal),
    deposit = paise(securityDeposit),
    extra = paise(additionalCharges);
  if (uatBypass) {
    if (!require('../../config/uatTax').isUatTaxBypass()) throw blocked('UAT_TAX_BYPASS_DISABLED');
    if (currency !== 'INR') throw blocked('GST_CURRENCY_UNSUPPORTED');
    const total = rent + extra + deposit;
    if (total > 999999999999n) throw blocked('AMOUNT_OUT_OF_RANGE');
    return {
      version: 2,
      taxMode: 'UAT_BYPASS',
      policyStatus: 'uat_bypass',
      policyVersion: null,
      gstRegistrationStatus: null,
      rentalSubtotal: major(rent),
      additionalCharges: major(extra),
      taxableAmount: null,
      tax: { type: 'UAT_BYPASS', totalTax: 0 },
      cess: { treatment: 'uat_bypass', totalCess: 0 },
      securityDeposit: major(deposit),
      depositTreatment: 'uat_bypass',
      grandTotal: major(total),
      currency,
    };
  }
  let approved = null;
  if (policy) {
    if (!['REGISTERED', 'UNREGISTERED'].includes(policy.gstRegistrationStatus))
      throw blocked('GST_REGISTRATION_STATUS_REQUIRED');
    const parsed = policySchema.safeParse(policy);
    if (!parsed.success) throw blocked('TAX_POLICY_CONFIGURATION_INVALID');
    approved = parsed.data;
  }
  const base = rent + extra;
  if (approved?.gstRegistrationStatus === 'UNREGISTERED') {
    if (currency !== 'INR') throw blocked('GST_CURRENCY_UNSUPPORTED');
    const total = base + deposit;
    if (total > 999999999999n) throw blocked('AMOUNT_OUT_OF_RANGE');
    return {
      version: 2,
      policyStatus: 'confirmed',
      policyVersion: approved.version,
      gstRegistrationStatus: 'UNREGISTERED',
      rentalSubtotal: major(rent),
      additionalCharges: major(extra),
      taxableAmount: null,
      tax: { type: 'NOT_COLLECTED', totalTax: 0 },
      cess: { treatment: 'not_collected' },
      sellerState: approved.sellerState,
      placeOfSupplyState: null,
      placeOfSupplyDetermination: null,
      depositTreatment: approved.depositTreatment,
      securityDeposit: major(deposit),
      grandTotal: major(total),
      currency,
    };
  }
  let cgst = 0n,
    sgst = 0n,
    igst = 0n;
  let mode = 'unconfigured',
    supply = null;
  if (approved) {
    if (currency !== 'INR') throw blocked('GST_CURRENCY_UNSUPPORTED');
    supply = determinePlaceOfSupply({ sellerState: approved.sellerState, recipient }).state;
    if (!state.safeParse(supply).success) throw blocked('CUSTOMER_BILLING_STATE_REQUIRED');
    mode = supply === approved.sellerState ? 'CGST_SGST' : 'IGST';
    if (mode === 'CGST_SGST' && ['04', '26', '31', '35', '38'].includes(supply))
      throw blocked('UTGST_POLICY_UNSUPPORTED');
    const rate = BigInt(approved.gstRateBps);
    if (mode === 'IGST') igst = (base * rate + 5000n) / 10000n;
    else {
      cgst = (base * rate + 10000n) / 20000n;
      sgst = cgst;
    }
  }
  const totalTax = cgst + sgst + igst;
  const grandTotal = base + totalTax + deposit;
  if (grandTotal > 999999999999n) throw blocked('AMOUNT_OUT_OF_RANGE');
  return {
    version: 2,
    gstRegistrationStatus: approved?.gstRegistrationStatus || null,
    policyStatus: approved ? 'confirmed' : 'TAX_POLICY_REQUIRES_BUSINESS_CONFIRMATION',
    policyVersion: approved?.version || null,
    rentalSubtotal: major(rent),
    additionalCharges: major(extra),
    taxableAmount: approved ? major(base) : null,
    tax: {
      type: mode,
      rate: (approved?.gstRateBps || 0) / 100,
      cgstRate: mode === 'CGST_SGST' ? approved.gstRateBps / 200 : 0,
      sgstRate: mode === 'CGST_SGST' ? approved.gstRateBps / 200 : 0,
      igstRate: mode === 'IGST' ? approved.gstRateBps / 100 : 0,
      cgst: major(cgst),
      sgst: major(sgst),
      igst: major(igst),
      totalTax: major(totalTax),
    },
    sellerState: approved?.sellerState || null,
    placeOfSupplyState: supply,
    placeOfSupplyDetermination: approved
      ? determinePlaceOfSupply({ sellerState: approved.sellerState, recipient })
      : null,
    depositTreatment: approved?.depositTreatment || 'unconfirmed',
    securityDeposit: major(deposit),
    grandTotal: major(grandTotal),
    currency,
  };
}
module.exports = {
  vehicleProfileSchema,
  selectVehiclePolicy,
  determinePlaceOfSupply,
  policySchema,
  calculateTax,
  paise,
  major,
  blocked,
};
