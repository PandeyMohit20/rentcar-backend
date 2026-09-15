'use strict';
const { z } = require('zod');
const AppError = require('../../errors/AppError');
const blocked = (code) => new AppError(code, 409, code);
const state = z.string().regex(/^(0[1-9]|[12][0-9]|3[0-8])$/);
const identity = {
  approved: z.literal(true),
  version: z.string().trim().min(1).max(80),
  legalName: z.string().trim().min(1).max(255),
  address: z.string().trim().min(1).max(1500),
  sellerState: state,
  state: z.string().trim().min(1).max(100).optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z
    .string()
    .regex(/^\+?[0-9 ()-]{7,30}$/)
    .optional(),
  depositTreatment: z.literal('refundable_not_consideration'),
};
const registered = z
  .object({
    ...identity,
    gstRegistrationStatus: z.literal('REGISTERED'),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
    sac: z.string().regex(/^\d{6}$/),
    placeOfSupplyRule: z.literal('igst_section_12_2'),
    gstRateBps: z.number().int().min(0).max(10000),
  })
  .strict();
const unregistered = z
  .object({
    ...identity,
    gstRegistrationStatus: z.literal('UNREGISTERED'),
    gstin: z.null().optional(),
    sac: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    placeOfSupplyRule: z.literal('not_applicable'),
    unregisteredPolicyConfirmed: z.literal(true),
    gstCollection: z.literal('not_collected'),
    cessTreatment: z.literal('not_collected'),
    documentTitle: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(
        (v) => !/gst|tax\s*invoice/i.test(v),
        'Unregistered document cannot claim GST tax-invoice status',
      ),
    documentApproved: z.literal(true),
    documentApprovalReference: z.string().trim().min(1).max(500),
  })
  .strict();
const checkState = (p) =>
  p.gstRegistrationStatus !== 'REGISTERED' || p.gstin.slice(0, 2) === p.sellerState;
const policySchema = z
  .discriminatedUnion('gstRegistrationStatus', [registered, unregistered])
  .refine(checkState, 'GSTIN state must match seller state');
const selector = {
  vehicleId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  approved: z.literal(true),
};
const oneSelector = (r) => !!r.vehicleId !== !!r.categoryId;
const registeredRate = z
  .object({
    ...selector,
    gstRateBps: z.number().int().min(0).max(10000),
    cessRateBps: z.number().int().min(0).max(10000),
  })
  .strict()
  .refine(oneSelector, 'Exactly one vehicle/category selector required');
const unregisteredRate = z
  .object({
    ...selector,
    gstCollection: z.literal('not_collected'),
    cessTreatment: z.literal('not_collected'),
  })
  .strict()
  .refine(oneSelector, 'Exactly one vehicle/category selector required');
const categories = z.record(z.string().min(1)).optional();
const vehicleProfileSchema = z
  .discriminatedUnion('gstRegistrationStatus', [
    registered
      .omit({ gstRateBps: true })
      .extend({
        vehicleCategoryAssignments: categories,
        vehicleRates: z.array(registeredRate).min(1),
      }),
    unregistered
      .omit({ gstCollection: true, cessTreatment: true })
      .extend({
        vehicleCategoryAssignments: categories,
        vehicleRates: z.array(unregisteredRate).min(1),
      }),
  ])
  .refine(checkState, 'GSTIN state must match seller state');
function selectVehiclePolicy(profile, car) {
  if (!['REGISTERED', 'UNREGISTERED'].includes(profile?.gstRegistrationStatus))
    throw blocked('GST_REGISTRATION_STATUS_REQUIRED');
  if (
    profile.gstRegistrationStatus === 'UNREGISTERED' &&
    !vehicleProfileSchema.safeParse(profile).success
  )
    throw blocked('TAX_POLICY_CONFIGURATION_INVALID');
  if (!Array.isArray(profile.vehicleRates)) throw blocked('VEHICLE_GST_AND_CESS_APPROVAL_REQUIRED');
  const rate =
    profile.vehicleRates.find((r) => r?.vehicleId === car.id) ||
    profile.vehicleRates.find(
      (r) =>
        r?.categoryId &&
        r.categoryId === (profile.vehicleCategoryAssignments?.[car.id] || car.categoryId),
    );
  if (!rate || rate.approved !== true) throw blocked('VEHICLE_GST_AND_CESS_APPROVAL_REQUIRED');
  const result = { ...profile };
  delete result.vehicleRates;
  delete result.vehicleCategoryAssignments;
  // Older registered JSON sometimes duplicated the selected rate at profile level.
  // That field is never used as the selected vehicle's rate.
  if (profile.gstRegistrationStatus === 'REGISTERED') {
    if (!Number.isInteger(rate.gstRateBps) || !Number.isInteger(rate.cessRateBps))
      throw blocked('VEHICLE_GST_AND_CESS_APPROVAL_REQUIRED');
    if (rate.cessRateBps !== 0) throw blocked('APPROVED_CESS_IMPLEMENTATION_REQUIRED');
    result.gstRateBps = rate.gstRateBps;
  } else {
    result.gstCollection = rate.gstCollection;
    result.cessTreatment = rate.cessTreatment;
  }
  if (!policySchema.safeParse(result).success) throw blocked('TAX_POLICY_CONFIGURATION_INVALID');
  return result;
}
module.exports = { state, policySchema, vehicleProfileSchema, selectVehiclePolicy };
