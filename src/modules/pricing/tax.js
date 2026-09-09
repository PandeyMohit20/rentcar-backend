'use strict';

const { z } = require('zod');
const AppError = require('../../errors/AppError');
const state = z.string().regex(/^(0[1-9]|[12][0-9]|3[0-8])$/);
// This is business configuration, not a legal classification selected by code.
const policySchema = z
  .object({
    approved: z.literal(true),
    version: z.string().min(1).max(80),
    gstRateBps: z.number().int().min(0).max(10000),
    sellerState: state,
    placeOfSupplyRule: z.literal('igst_section_12_2'),
    depositTreatment: z.literal('refundable_not_consideration'),
    legalName: z.string().min(1).max(255),
    address: z.string().min(1).max(1500),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
    sac: z.string().regex(/^\d{6}$/),
    supportEmail: z.string().email().optional(),
  })
  .strict()
  .refine((p) => p.gstin.slice(0, 2) === p.sellerState, 'GSTIN state must match seller state');

const vehicleProfileSchema = policySchema
  .innerType()
  .omit({ gstRateBps: true })
  .extend({
    vehicleCategoryAssignments: z.record(z.string()).optional(),
    vehicleRates: z
      .array(
        z
          .object({
            vehicleId: z.string().optional(),
            categoryId: z.string().optional(),
            approved: z.literal(true),
            gstRateBps: z.number().int().min(0).max(10000),
            cessRateBps: z.number().int().min(0).max(10000),
          })
          .strict()
          .refine(
            (r) => !!r.vehicleId !== !!r.categoryId,
            'Exactly one vehicle/category selector required',
          ),
      )
      .min(1),
  })
  .refine((p) => p.gstin.slice(0, 2) === p.sellerState, 'GSTIN state must match seller state');
function selectVehiclePolicy(profile, car) {
  if (!profile?.vehicleRates) throw blocked('VEHICLE_GST_AND_CESS_APPROVAL_REQUIRED');
  const rate =
    profile.vehicleRates.find((r) => r.vehicleId === car.id) ||
    profile.vehicleRates.find(
      (r) =>
        r.categoryId &&
        r.categoryId === (profile.vehicleCategoryAssignments?.[car.id] || car.categoryId),
    );
  if (
    !rate ||
    rate.approved !== true ||
    !Number.isInteger(rate.gstRateBps) ||
    !Number.isInteger(rate.cessRateBps)
  )
    throw blocked('VEHICLE_GST_AND_CESS_APPROVAL_REQUIRED');
  // Nonzero cess requires its approved calculation basis and invoice representation.
  if (rate.cessRateBps !== 0) throw blocked('APPROVED_CESS_IMPLEMENTATION_REQUIRED');
  const identity = { ...profile };
  delete identity.vehicleRates;
  delete identity.vehicleCategoryAssignments;
  return { ...identity, gstRateBps: rate.gstRateBps };
}
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
}) {
  const rent = paise(rentalSubtotal),
    deposit = paise(securityDeposit),
    extra = paise(additionalCharges);
  let approved = null;
  if (policy) {
    const parsed = policySchema.safeParse(policy);
    if (!parsed.success) throw blocked('TAX_POLICY_CONFIGURATION_INVALID');
    approved = parsed.data;
  }
  const base = rent + extra;
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
    version: 1,
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
