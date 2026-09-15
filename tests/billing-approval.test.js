'use strict';
// Local regression tests only. These fixtures are never live UAT evidence.
const request = require('supertest');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');
const { createApp } = require('../src/app');
const { authorizeRole } = require('../src/middlewares/authorize');
const {
  review,
  complete,
  approvalSchema,
  validateState,
  PENDING,
  saveProfile,
} = require('../src/modules/billingApproval/service');

const profile = {
  gstRegistrationStatus: 'REGISTERED',
  approved: true,
  version: 'test-only',
  sellerState: '27',
  placeOfSupplyRule: 'igst_section_12_2',
  depositTreatment: 'refundable_not_consideration',
  legalName: 'Test Seller',
  address: 'Test Address',
  gstin: '27AAAAA0000A1Z5',
  sac: '999999',
  vehicleRates: [{ vehicleId: 'car', approved: true, gstRateBps: 1800, cessRateBps: 0 }],
};
function database() {
  const state = {
    setting: { id: 'setting', value: JSON.stringify({ status: PENDING }), updatedAt: new Date(0) },
    cars: [{ id: 'car', vendorId: 'vendor' }],
    vendors: [
      { id: 'vendor', status: 'active', isDeleted: false, taxProfile: structuredClone(profile) },
    ],
    pricing: [
      {
        id: 'pricing',
        carId: 'car',
        status: 'active',
        currencyCode: 'INR',
        dailyPrice: '100.00',
        effectiveFrom: null,
        effectiveTo: null,
      },
    ],
  };
  const db = {
    setting: {
      findUnique: jest.fn(async () => structuredClone(state.setting)),
      updateMany: jest.fn(async ({ data }) => {
        Object.assign(state.setting, data);
        return { count: 1 };
      }),
    },
    car: { findMany: jest.fn(async () => structuredClone(state.cars)) },
    vendor: {
      findMany: jest.fn(async () => structuredClone(state.vendors)),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(
          state.vendors.find((v) => v.id === where.id),
          data,
        ),
      ),
    },
    carPricing: { findMany: jest.fn(async () => structuredClone(state.pricing)) },
    auditLog: { create: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
  };
  db.$transaction = jest.fn(async (fn) => {
    const before = structuredClone(state);
    try {
      return await fn(db);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  });
  return { db, state };
}
async function body(db) {
  return {
    reviewHash: (await review(db)).reviewHash,
    idempotencyKey: '3ef5a27e-39b7-4d19-82ec-611f69c503d1',
    rateConfirmed: true,
    cessConfirmed: true,
    taxConfirmed: true,
    globalScopeConfirmed: true,
    rateApprovalReference: 'test-only rate approval',
    cessApprovalReference: 'test-only cess approval',
    commercialStructureApprovalReference: 'test-only structure approval',
  };
}

describe('Global billing approval safeguards (local tests)', () => {
  it('reports missing decisions and confirmations without writes', async () => {
    const { db, state } = database();
    state.vendors[0].taxProfile = null;
    const result = await review(db);
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining([
        'MISSING_VENDOR_TAX_PROFILE',
        'GST_DECISION_REQUIRED',
        'CESS_DECISION_REQUIRED',
        'RATE_CONFIRMATION_REQUIRED',
        'CESS_CONFIRMATION_REQUIRED',
      ]),
    );
    expect(db.setting.updateMany).not.toHaveBeenCalled();
    expect(db.vendor.update).not.toHaveBeenCalled();
  });
  it('saves an explicitly approved profile with audit while retaining the pending gate', async () => {
    const { db, state } = database();
    state.vendors[0].taxProfile = null;
    const input = {
      reviewHash: (await review(db)).reviewHash,
      businessApprovalReference: 'test-only',
      decisionsConfirmed: true,
      profile,
    };
    await saveProfile('vendor', input, 'admin', db);
    expect(state.vendors[0].taxProfile).toEqual(profile);
    expect(JSON.parse(state.setting.value).status).toBe(PENDING);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    await expect(saveProfile('vendor', input, 'admin', db)).rejects.toThrow('BILLING_REVIEW_STALE');
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('rejects implicit profile decisions and rolls back profile on audit failure', async () => {
    const { db, state } = database();
    state.vendors[0].taxProfile = null;
    const input = {
      reviewHash: (await review(db)).reviewHash,
      businessApprovalReference: 'test-only',
      decisionsConfirmed: true,
      profile,
    };
    await expect(
      saveProfile('vendor', { ...input, decisionsConfirmed: false }, 'admin', db),
    ).rejects.toMatchObject({ statusCode: 422 });
    db.auditLog.create.mockRejectedValue(new Error('audit failed'));
    await expect(saveProfile('vendor', input, 'admin', db)).rejects.toThrow('audit failed');
    expect(state.vendors[0].taxProfile).toBeNull();
  });
  it('shows READY only after completion and detects subsequent scope changes', async () => {
    const { db, state } = database();
    await complete(await body(db), 'admin', db);
    expect((await review(db)).readiness.status).toBe('READY');
    state.pricing[0].dailyPrice = '101';
    expect((await review(db)).readiness.blockers.map((b) => b.code)).toContain('STALE_REVIEW');
  });
  it('protects both routes from unauthenticated access', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/admin/billing-approval')).status).toBe(401);
    expect(
      (await request(app).post('/api/v1/admin/billing-approval/complete').send({})).status,
    ).toBe(401);
  });
  it.each(['CUSTOMER', 'VENDOR', 'PLATFORM_ADMIN'])(
    'denies %s even with broad permissions',
    (role) => {
      const next = jest.fn();
      authorizeRole('SUPER_ADMIN')({ user: { roles: [role], permissions: ['*'] } }, {}, next);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    },
  );
  it('allows the explicit SUPER_ADMIN role', () => {
    const next = jest.fn();
    authorizeRole('SUPER_ADMIN')({ user: { roles: ['SUPER_ADMIN'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
  it('requires each explicit confirmation and approval reference', async () => {
    const { db } = database();
    const payload = await body(db);
    for (const key of Object.keys(payload)) {
      const omitted = { ...payload };
      delete omitted[key];
      expect(approvalSchema.safeParse(omitted).success).toBe(false);
    }
    expect(approvalSchema.safeParse({ ...payload, cessConfirmed: false }).success).toBe(false);
    expect(approvalSchema.safeParse({ ...payload, cessApprovalReference: ' ' }).success).toBe(
      false,
    );
  });
  it('atomically records approval and audit, preserves private/inactive fields, and replays once', async () => {
    const { db, state } = database();
    state.setting.isActive = false;
    state.setting.isPublic = false;
    const payload = await body(db);
    const result = await complete(payload, 'admin', db);
    expect(result.status).toBe('APPROVED');
    expect(state.setting).toMatchObject({ isActive: false, isPublic: false });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(await complete(payload, 'admin', db)).toMatchObject({
      approvalId: result.approvalId,
      replayed: true,
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    await expect(
      complete({ ...payload, rateApprovalReference: 'different' }, 'admin', db),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(complete(payload, 'another-admin', db)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
  it.each(['pricing', 'profile', 'inventory', 'setting'])(
    'rejects a stale %s review',
    async (change) => {
      const { db, state } = database();
      const payload = await body(db);
      if (change === 'pricing') state.pricing[0].dailyPrice = '101.00';
      if (change === 'profile') state.vendors[0].taxProfile.version = 'changed';
      if (change === 'inventory') state.cars.push({ id: 'another', vendorId: 'vendor' });
      if (change === 'setting') state.setting.updatedAt = new Date(1);
      await expect(complete(payload, 'admin', db)).rejects.toThrow('BILLING_REVIEW_STALE');
      expect(db.setting.updateMany).not.toHaveBeenCalled();
    },
  );
  it('requires every vehicle policy, including other vendors', async () => {
    const { db, state } = database();
    state.cars.push({ id: 'other', vendorId: 'missing' });
    await expect(complete(await body(db), 'admin', db)).rejects.toThrow('ACTIVE_VENDOR_REQUIRED');
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it('reports missing configuration without changing it', async () => {
    const { db, state } = database();
    state.vendors[0].taxProfile = null;
    expect((await review(db)).blocker).toBe('TAX_POLICY_CONFIGURATION_INVALID');
    await expect(complete(await body(db), 'admin', db)).rejects.toThrow(
      'TAX_POLICY_CONFIGURATION_INVALID',
    );
    expect(db.setting.updateMany).not.toHaveBeenCalled();
  });
  it.each([undefined, -1, 1.5, 10001])('rejects missing/invalid CESS %s', (cess) => {
    const { state } = database();
    state.vendors[0].taxProfile.vehicleRates[0].cessRateBps = cess;
    expect(() => validateState(state)).toThrow('TAX_POLICY_CONFIGURATION_INVALID');
  });
  it('preserves nonzero CESS restriction', () => {
    const { state } = database();
    state.vendors[0].taxProfile.vehicleRates[0].cessRateBps = 100;
    expect(() => validateState(state)).toThrow('APPROVED_CESS_IMPLEMENTATION_REQUIRED');
  });
  it('rejects ambiguous selectors', () => {
    const { state } = database();
    state.vendors[0].taxProfile.vehicleRates.push({ ...profile.vehicleRates[0] });
    expect(() => validateState(state)).toThrow('DUPLICATE_TAX_RATE_SELECTOR');
  });
  it.each(['-1', '1.001', 'NaN', '10000000000'])('rejects invalid money %s', (amount) => {
    const { state } = database();
    state.pricing[0].dailyPrice = amount;
    expect(() => validateState(state)).toThrow();
  });
  it('rejects reversed effective dates', () => {
    const { state } = database();
    Object.assign(state.pricing[0], { effectiveFrom: '2026-10-01', effectiveTo: '2026-09-01' });
    expect(() => validateState(state)).toThrow('INVALID_PRICING_EFFECTIVE_DATES');
  });
  it('rolls back on audit failure', async () => {
    const { db, state } = database();
    db.auditLog.create.mockRejectedValue(new Error('audit failed'));
    await expect(complete(await body(db), 'admin', db)).rejects.toThrow('audit failed');
    expect(JSON.parse(state.setting.value).status).toBe(PENDING);
  });
  it('rejects a lost compare-and-swap without creating an audit', async () => {
    const { db } = database();
    db.setting.updateMany.mockResolvedValue({ count: 0 });
    await expect(complete(await body(db), 'admin', db)).rejects.toThrow('BILLING_REVIEW_STALE');
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it('maps serialization conflicts to a safe retry response', async () => {
    const { db } = database();
    const payload = await body(db);
    db.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(complete(payload, 'admin', db)).rejects.toMatchObject({
      code: 'BILLING_REVIEW_STALE',
      statusCode: 409,
    });
  });
});

describe('Billing approval HTTP authorization using DB-backed roles (local test database)', () => {
  beforeEach(resetStore);
  it.each(['CUSTOMER', 'VENDOR', 'PLATFORM_ADMIN'])(
    'denies %s on all approval endpoints',
    async (role) => {
      const user = await seedUser({ email: `${role}@example.test`, roles: [role] });
      const token = signAccessToken({ sub: user.id });
      const app = createApp();
      for (const [method, path] of [
        ['get', ''],
        ['post', '/complete'],
        ['put', '/vendors/564ebf45-1cae-4ca1-a29e-d4794733b57c/tax-profile'],
      ]) {
        const agent = request(app);
        const result = await agent[method](`/api/v1/admin/billing-approval${path}`)
          .set('Authorization', `Bearer ${token}`)
          .send({});
        expect(result.status).toBe(403);
      }
    },
  );
  it('permits valid SUPER_ADMIN review and completion through the actual router', async () => {
    const user = await seedUser({ email: 'approval-admin@example.test', roles: ['SUPER_ADMIN'] });
    const { state } = database();
    await prisma.setting.create({
      data: { ...state.setting, key: 'billing.issuer.phase7b.pending' },
    });
    await prisma.vendor.create({ data: state.vendors[0] });
    await prisma.car.create({ data: { ...state.cars[0], isDeleted: false } });
    await prisma.carPricing.create({ data: state.pricing[0] });
    const token = signAccessToken({ sub: user.id });
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/billing-approval')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const input = { ...(await body(prisma)), reviewHash: response.body.data.reviewHash };
    const result = await request(app)
      .post('/api/v1/admin/billing-approval/complete')
      .set('Authorization', `Bearer ${token}`)
      .send(input);
    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('APPROVED');
  });
});
