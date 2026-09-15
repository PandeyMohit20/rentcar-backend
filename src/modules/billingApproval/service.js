'use strict';

const crypto = require('crypto');
const { z } = require('zod');
const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const { vehicleProfileSchema, selectVehiclePolicy, paise } = require('../pricing/tax');

const KEY = 'billing.issuer.phase7b.pending';
const PENDING = 'PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION';
const reference = z.string().trim().min(1).max(500);
const approvalSchema = z
  .object({
    reviewHash: z.string().regex(/^[a-f0-9]{64}$/),
    idempotencyKey: z.string().uuid(),
    rateConfirmed: z.literal(true),
    cessConfirmed: z.literal(true),
    taxConfirmed: z.literal(true),
    globalScopeConfirmed: z.literal(true),
    rateApprovalReference: reference,
    cessApprovalReference: reference,
    commercialStructureApprovalReference: reference,
  })
  .strict();
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const conflict = (code) => new AppError(code, 409, code);

async function readState(db) {
  const setting = await db.setting.findUnique({ where: { key: KEY } });
  if (!setting) throw conflict('BILLING_APPROVAL_RECORD_REQUIRED');
  let configuration;
  try {
    configuration = JSON.parse(setting.value);
  } catch {
    throw conflict('BILLING_CONFIGURATION_INVALID');
  }
  // The existing gate is global. Reviewing only one vendor would release all others.
  const cars = await db.car.findMany({
    where: { isDeleted: false },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      vendorId: true,
      branchId: true,
      brand: true,
      model: true,
      status: true,
      updatedAt: true,
    },
  });
  const vendors = await db.vendor.findMany({
    where: { id: { in: [...new Set(cars.map((car) => car.vendorId))] } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      companyName: true,
      status: true,
      isDeleted: true,
      taxProfile: true,
      updatedAt: true,
    },
  });
  const pricing = await db.carPricing.findMany({
    where: { carId: { in: cars.map((car) => car.id) }, status: 'active' },
    orderBy: { id: 'asc' },
  });
  return { setting, configuration, cars, vendors, pricing };
}

function validateState(state) {
  const { cars, vendors, pricing } = state;
  if (!cars.length) throw conflict('BILLING_APPROVAL_SCOPE_EMPTY');
  for (const vendor of vendors) {
    if (vendor.isDeleted || vendor.status !== 'active') throw conflict('ACTIVE_VENDOR_REQUIRED');
    if (!vehicleProfileSchema.safeParse(vendor.taxProfile).success)
      throw conflict('TAX_POLICY_CONFIGURATION_INVALID');
    const selectors = vendor.taxProfile.vehicleRates.map((r) =>
      r.vehicleId ? `v:${r.vehicleId}` : `c:${r.categoryId}`,
    );
    if (new Set(selectors).size !== selectors.length) throw conflict('DUPLICATE_TAX_RATE_SELECTOR');
  }
  for (const car of cars) {
    const vendor = vendors.find((v) => v.id === car.vendorId);
    if (!vendor) throw conflict('ACTIVE_VENDOR_REQUIRED');
    // Reuse the authoritative selector, including its nonzero-CESS fail-closed rule.
    selectVehiclePolicy(vendor.taxProfile, car);
    const records = pricing.filter((p) => p.carId === car.id);
    if (!records.length) throw conflict('ACTIVE_PRICING_REQUIRED');
    for (const record of records) {
      if (record.currencyCode !== 'INR') throw conflict('GST_CURRENCY_UNSUPPORTED');
      if (record.dailyPrice === null || record.dailyPrice === undefined)
        throw conflict('INVALID_MONEY');
      for (const field of [
        'dailyPrice',
        'hourlyPrice',
        'weeklyPrice',
        'monthlyPrice',
        'extraHourPrice',
        'extraKmPrice',
        'securityDeposit',
      ]) {
        if (record[field] !== null && record[field] !== undefined) paise(record[field]);
      }
      const from =
        record.effectiveFrom === null || record.effectiveFrom === undefined
          ? null
          : new Date(record.effectiveFrom).getTime();
      const to =
        record.effectiveTo === null || record.effectiveTo === undefined
          ? null
          : new Date(record.effectiveTo).getTime();
      if (
        (from !== null && !Number.isFinite(from)) ||
        (to !== null && !Number.isFinite(to)) ||
        (from !== null && to !== null && from >= to)
      )
        throw conflict('INVALID_PRICING_EFFECTIVE_DATES');
    }
  }
}

async function review(db = prisma) {
  const state = await readState(db);
  let blocker = null;
  try {
    validateState(state);
  } catch (error) {
    if (!error.isOperational) throw error;
    blocker = error.code;
  }
  const blockers = [];
  const add = (code, entityId, field) => blockers.push({ code, entityId, field });
  for (const vendor of state.vendors) {
    if (!vendor.taxProfile) add('MISSING_VENDOR_TAX_PROFILE', vendor.id, 'taxProfile');
    const registration = vendor.taxProfile?.gstRegistrationStatus;
    if (!['REGISTERED', 'UNREGISTERED'].includes(registration))
      add('GST_REGISTRATION_STATUS_REQUIRED', vendor.id, 'gstRegistrationStatus');
    if (registration === 'REGISTERED' && !vendor.taxProfile.gstin)
      add('MISSING_GSTIN', vendor.id, 'gstin');
    if (registration === 'UNREGISTERED' && vendor.taxProfile.unregisteredPolicyConfirmed !== true)
      add(
        'UNREGISTERED_TAX_POLICY_CONFIRMATION_REQUIRED',
        vendor.id,
        'unregisteredPolicyConfirmed',
      );
    for (const car of state.cars.filter((c) => c.vendorId === vendor.id)) {
      const profile = vendor.taxProfile;
      const rates = Array.isArray(profile?.vehicleRates) ? profile.vehicleRates : [];
      const rate =
        rates.find((r) => r?.vehicleId === car.id) ||
        rates.find(
          (r) => r?.categoryId && r.categoryId === profile?.vehicleCategoryAssignments?.[car.id],
        );
      if (registration === 'UNREGISTERED') {
        if (rate?.gstCollection !== 'not_collected')
          add('UNREGISTERED_TAX_POLICY_CONFIRMATION_REQUIRED', car.id, 'gstCollection');
        if (rate?.cessTreatment !== 'not_collected')
          add('CESS_DECISION_REQUIRED', car.id, 'cessTreatment');
      } else {
        if (!Number.isInteger(rate?.gstRateBps)) add('GST_DECISION_REQUIRED', car.id, 'gstRateBps');
        if (!Number.isInteger(rate?.cessRateBps))
          add('CESS_DECISION_REQUIRED', car.id, 'cessRateBps');
      }
    }
  }
  const receipt = state.configuration.approvalReceipt;
  if (
    state.configuration.status === 'APPROVED' &&
    receipt?.scopeHash !==
      hash({ cars: state.cars, vendors: state.vendors, pricing: state.pricing })
  )
    add('STALE_REVIEW', state.setting.id, 'reviewHash');
  if (state.configuration.status !== 'APPROVED' || receipt?.rateConfirmed !== true)
    add('RATE_CONFIRMATION_REQUIRED', state.setting.id, 'rateConfirmed');
  if (state.configuration.status !== 'APPROVED' || receipt?.cessConfirmed !== true)
    add('CESS_CONFIRMATION_REQUIRED', state.setting.id, 'cessConfirmed');
  if (state.configuration.status !== 'APPROVED' || receipt?.taxConfirmed !== true)
    add('TAX_CONFIRMATION_REQUIRED', state.setting.id, 'taxConfirmed');
  if (blocker)
    add(
      blocker === 'INVALID_PRICING_EFFECTIVE_DATES' ? 'INVALID_EFFECTIVE_DATES' : blocker,
      state.setting.id,
      null,
    );
  const audits = await db.auditLog.findMany({
    where: {
      module: 'billing',
      entityId: { in: [state.setting.id, ...state.vendors.map((v) => v.id)] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      userId: true,
      action: true,
      entityId: true,
      result: true,
      createdAt: true,
      metadata: true,
    },
  });
  return {
    reviewHash: hash(state),
    scope: 'ALL_NON_DELETED_CARS',
    blocker,
    audits,
    readiness: {
      status: blockers.length ? 'BLOCKED' : 'READY',
      scope: 'BILLING_CONFIGURATION_ONLY',
      blockers,
    },
    ...state,
  };
}

const profileUpdateSchema = z
  .object({
    reviewHash: z.string().regex(/^[a-f0-9]{64}$/),
    businessApprovalReference: reference,
    decisionsConfirmed: z.literal(true),
    profile: vehicleProfileSchema,
  })
  .strict();

async function saveProfile(vendorId, input, actorId, db = prisma) {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      'Approved policy fields are invalid.',
      422,
      'TAX_POLICY_CONFIGURATION_INVALID',
    );
  const body = parsed.data;
  try {
    return await db.$transaction(
      async (tx) => {
        const state = await readState(tx);
        if (![PENDING, 'APPROVED'].includes(state.configuration.status))
          throw conflict('BILLING_APPROVAL_NOT_PENDING');
        if (hash(state) !== body.reviewHash) throw conflict('BILLING_REVIEW_STALE');
        const vendor = state.vendors.find((v) => v.id === vendorId);
        if (!vendor || vendor.isDeleted || vendor.status !== 'active')
          throw conflict('ACTIVE_VENDOR_REQUIRED');
        if (
          vendor.taxProfile &&
          vendor.taxProfile.gstRegistrationStatus !== body.profile.gstRegistrationStatus &&
          vendor.taxProfile.version === body.profile.version
        )
          throw conflict('POLICY_VERSION_CHANGE_REQUIRED');
        const scope = state.cars.filter((c) => c.vendorId === vendorId);
        const owned = new Set(scope.map((c) => c.id));
        if (
          body.profile.vehicleRates.some((r) => r.vehicleId && !owned.has(r.vehicleId)) ||
          Object.keys(body.profile.vehicleCategoryAssignments || {}).some((id) => !owned.has(id))
        )
          throw conflict('TAX_POLICY_VEHICLE_SCOPE_INVALID');
        // Validate the complete replacement against this vendor's scope and existing prices.
        validateState({
          cars: scope,
          vendors: [{ ...vendor, taxProfile: body.profile }],
          pricing: state.pricing.filter((p) => scope.some((c) => c.id === p.carId)),
        });
        await tx.vendor.update({ where: { id: vendorId }, data: { taxProfile: body.profile } });
        // Any reviewed policy edit reopens the global gate, retaining the prior receipt/history.
        const reopened = await tx.setting.updateMany({
          where: { id: state.setting.id, value: state.setting.value },
          data: { value: JSON.stringify({ ...state.configuration, status: PENDING }) },
        });
        if (reopened.count !== 1) throw conflict('BILLING_REVIEW_STALE');
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'billing.tax-profile.save',
            module: 'billing',
            entity: 'Vendor',
            entityId: vendorId,
            result: 'saved',
            metadata: JSON.stringify({
              reviewHash: body.reviewHash,
              businessApprovalReference: body.businessApprovalReference,
              previousProfileHash: hash(vendor.taxProfile),
              profileHash: hash(body.profile),
              version: body.profile.version,
              oldRegistrationStatus: vendor.taxProfile?.gstRegistrationStatus || null,
              newRegistrationStatus: body.profile.gstRegistrationStatus,
              decisionsConfirmed: true,
            }),
          },
        });
        return { vendorId, version: body.profile.version, status: PENDING };
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (error.code === 'P2034') throw conflict('BILLING_REVIEW_STALE');
    throw error;
  }
}

async function complete(input, actorId, db = prisma) {
  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError('Explicit approval fields are required.', 422, 'BILLING_APPROVAL_INVALID');
  const body = parsed.data;
  const requestHash = hash(body);
  try {
    return await db.$transaction(
      async (tx) => {
        const state = await readState(tx);
        const receipt = state.configuration.approvalReceipt;
        if (receipt?.idempotencyKey === body.idempotencyKey) {
          if (
            state.configuration.status !== 'APPROVED' ||
            receipt.scopeHash !==
              hash({ cars: state.cars, vendors: state.vendors, pricing: state.pricing })
          )
            throw conflict('BILLING_REVIEW_STALE');
          if (receipt.requestHash !== requestHash || receipt.actorId !== actorId)
            throw conflict('IDEMPOTENCY_CONFLICT');
          return { status: state.configuration.status, approvalId: receipt.id, replayed: true };
        }
        if (state.configuration.status !== PENDING) throw conflict('BILLING_APPROVAL_NOT_PENDING');
        if (hash(state) !== body.reviewHash) throw conflict('BILLING_REVIEW_STALE');
        validateState(state);
        const id = crypto.randomUUID();
        const approvalReceipt = {
          ...body,
          scopeHash: hash({ cars: state.cars, vendors: state.vendors, pricing: state.pricing }),
          id,
          actorId,
          requestHash,
          approvedAt: new Date().toISOString(),
        };
        const updated = await tx.setting.updateMany({
          where: {
            id: state.setting.id,
            value: state.setting.value,
            updatedAt: state.setting.updatedAt,
          },
          data: {
            value: JSON.stringify({ ...state.configuration, status: 'APPROVED', approvalReceipt }),
          },
        });
        if (updated.count !== 1) throw conflict('BILLING_REVIEW_STALE');
        // Same transaction: an audit failure must roll back approval.
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'billing.approval.complete',
            module: 'billing',
            entity: 'Setting',
            entityId: state.setting.id,
            result: 'approved',
            requestId: body.idempotencyKey,
            metadata: JSON.stringify({
              ...approvalReceipt,
              previousStatus: PENDING,
              carIds: state.cars.map((c) => c.id),
              pricingIds: state.pricing.map((p) => p.id),
            }),
          },
        });
        return { status: 'APPROVED', approvalId: id, replayed: false };
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (error.code === 'P2034') throw conflict('BILLING_REVIEW_STALE');
    throw error;
  }
}

module.exports = {
  review,
  complete,
  saveProfile,
  profileUpdateSchema,
  approvalSchema,
  validateState,
  KEY,
  PENDING,
};
