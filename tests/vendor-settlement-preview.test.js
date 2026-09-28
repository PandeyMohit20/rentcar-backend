'use strict';

const request = require('supertest');
const { v4: uuid } = require('uuid');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedRole, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

describe('settlement preview and list access', () => {
  let app; let vendor; let member; let outsider; let admin; let superAdmin; let customer; let booking;
  const auth = (user) => ({ Authorization: `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}` });
  const get = (user = member, suffix = '/preview', query = {}, vendorId = vendor.id) => request(app)
    .get(`/api/v1/vendors/${vendorId}/settlements${suffix}`).set(auth(user)).query(query);
  async function addBooking(changes = {}) {
    const b = await prisma.booking.create({ data: {
      bookingNumber: `BK-${uuid()}`, vendorId: vendor.id, userId: customer.id, carId: uuid(),
      status: 'COMPLETED', paymentStatus: 'succeeded', currencyCode: 'INR', subtotal: '100.00', tax: '18.00',
      discount: '0.00', securityDeposit: '50.00', totalAmount: '168.00', vendorCommissionRate: '10.00', vendorCommision: '10.00',
      ...changes,
    } });
    await prisma.payment.create({ data: { bookingId: b.id, userId: customer.id, amount: b.totalAmount,
      currencyCode: b.currencyCode, status: 'succeeded', operationalStatus: 'normal', providerPaymentId: `private-${uuid()}`,
      paidAt: new Date(), providerOrderId: `private-order-${uuid()}` } });
    return b;
  }
  beforeAll(() => { app = createApp(); });
  beforeEach(async () => {
    resetStore();
    await seedRole('SETTLEMENT_MEMBER', { permissions: ['vendors.view'] });
    await seedRole('GLOBAL_ADMIN', { permissions: ['admin.all'] });
    await seedRole('SUPER_ADMIN');
    member = await seedUser({ email: `${uuid()}@test.dev`, roles: ['SETTLEMENT_MEMBER'] });
    outsider = await seedUser({ email: `${uuid()}@test.dev`, roles: ['SETTLEMENT_MEMBER'] });
    admin = await seedUser({ email: `${uuid()}@test.dev`, roles: ['GLOBAL_ADMIN'] });
    superAdmin = await seedUser({ email: `${uuid()}@test.dev`, roles: ['SUPER_ADMIN'] });
    customer = await seedUser({ email: `${uuid()}@test.dev` });
    vendor = await prisma.vendor.create({ data: { vendorCode: uuid(), companyName: 'Preview Vendor', commissionRate: '90.00' } });
    await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: member.id } });
    const other = await prisma.vendor.create({ data: { vendorCode: uuid(), companyName: 'Other' } });
    await prisma.vendorMember.create({ data: { vendorId: other.id, userId: outsider.id } });
    booking = await addBooking();
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns completed-only vendor-owned facts and bounded page metadata', async () => {
    await addBooking({ status: 'ACTIVE' }); await addBooking({ status: 'CANCELLED' }); await addBooking({ vendorId: uuid() });
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(response.body.data.bookings).toHaveLength(1);
    expect(response.body.data.bookings[0]).toMatchObject({ bookingId: booking.id, eligibleForReview: true, generationReady: false, netPayable: null });
    expect(response.body.data).toMatchObject({ generationReady: false, netPayable: null, summary: { scope: 'page', inclusion: 'eligibleForReview' } });
    expect(Number.isFinite(Date.parse(response.body.data.observedAt))).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/private-|providerPaymentId|providerOrderId|accountNumber/);
  });
  it.each(['/preview', ''])('hides inaccessible vendors on %s', async (suffix) => {
    const denied = await get(outsider, suffix);
    const absent = await get(outsider, suffix, {}, uuid());
    expect(denied.status).toBe(404); expect(absent.status).toBe(404);
    expect(denied.body.message).toBe(absent.body.message);
  });
  it.each(['/preview', ''])('allows global admin and SUPER_ADMIN on %s', async (suffix) => {
    expect((await get(admin, suffix)).status).toBe(200);
    expect((await get(superAdmin, suffix)).status).toBe(200);
    expect((await get(member, suffix)).status).toBe(200);
  });
  it('does not grant a kyc.review bypass or allow membership without read permission', async () => {
    await seedRole('KYC_ONLY', { permissions: ['kyc.review'] });
    const reviewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['KYC_ONLY'] });
    await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: customer.id } });
    expect((await get(reviewer)).status).toBe(403);
    expect((await get(customer)).status).toBe(403);
    expect((await request(app).get(`/api/v1/vendors/${vendor.id}/settlements/preview`)).status).toBe(401);
  });
  it('does not use a changed current vendor commission', async () => {
    const before = (await get()).body.data.bookings[0].financialFacts;
    await prisma.vendor.update({ where: { id: vendor.id }, data: { commissionRate: '99.00' } });
    const after = (await get()).body.data.bookings[0].financialFacts;
    expect(after).toEqual(before);
    expect(after.commissionAmountSnapshot).toBe('10.00');
  });
  it.each([{ pageSize: 101 }, { pageSize: 0 }, { page: -1 }, { page: 100001 }, { currency: 'inr' }, { periodStart: '2030-01-01' }, { pageSize: 'bad' }])('rejects invalid or unsupported query %j', async (query) => {
    expect((await get(member, '/preview', query)).status).toBe(422);
  });
  it('paginates and filters currencies without merging their totals', async () => {
    await addBooking({ currencyCode: 'USD' });
    const mixed = await get();
    expect(mixed.body.data.summary.byCurrency.map((g) => g.currencyCode).sort()).toEqual(['INR', 'USD']);
    const page = await get(member, '/preview', { pageSize: 1, page: 2 });
    expect(page.body.data.bookings).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ total: 2, totalPages: 2 });
    expect(page.body.data.summary.byCurrency).toHaveLength(1);
    const usd = await get(member, '/preview', { currency: 'USD' });
    expect(usd.body.meta.total).toBe(1);
    expect(usd.body.data.bookings[0].currencyCode).toBe('USD');
  });
  it('loads all attempts, settlement items and reconciliation evidence', async () => {
    const p = await prisma.payment.findFirst({ where: { bookingId: booking.id } });
    await prisma.payment.create({ data: {
      ...p,
      id: uuid(),
      providerOrderId: `private-order-${uuid()}`,
      providerPaymentId: `private-payment-${uuid()}`,
      transactionReference: null,
      operationalStatus: 'late_payment_conflict',
    } });
    await prisma.vendorSettlementItem.create({ data: { bookingId: booking.id, paymentId: p.id, settlementId: uuid() } });
    await prisma.auditLog.create({ data: { entityId: booking.id, action: 'payment.reconcile', result: 'requires_review', metadata: JSON.stringify({ capturedPaymentIds: ['private-a', 'private-b'] }) } });
    const row = (await get()).body.data.bookings[0];
    expect(row.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['MULTIPLE_CAPTURED_PAYMENTS', 'LATE_PAYMENT_CONFLICT', 'BOOKING_SETTLED_OTHER_PAYMENT', 'RECONCILIATION_REVIEW_REQUIRED']));
    expect(JSON.stringify(row)).not.toContain('private-');
  });
  it('loads successful and unresolved refunds for the selected payment', async () => {
    const p = await prisma.payment.findFirst({ where: { bookingId: booking.id } });
    for (const [amount, status] of [['0.10', 'succeeded'], ['0.20', 'succeeded'], ['5', 'pending']]) {
      await prisma.refund.create({ data: { paymentId: p.id, bookingId: booking.id, currencyCode: 'INR', amount, status } });
    }
    const row = (await get()).body.data.bookings[0];
    expect(row.financialFacts).toMatchObject({ successfulRefunded: '0.30', remainingCaptured: '167.70' });
    expect(row.refunds.unresolvedCount).toBe(1);
  });
  it('performs no writes, raw SQL, provider calls or reconciliation', async () => {
    const before = JSON.stringify(prisma.$store);
    const spies = [];
    for (const [name, delegate] of Object.entries(prisma)) {
      if (name.startsWith('$') || !delegate || typeof delegate !== 'object') continue;
      for (const method of ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']) {
        if (typeof delegate[method] === 'function') spies.push(jest.spyOn(delegate, method).mockImplementation(() => { throw new Error('Preview attempted a write'); }));
      }
    }
    for (const method of ['$queryRaw', '$queryRawUnsafe']) spies.push(jest.spyOn(prisma, method));
    const provider = require('../src/modules/payments/providers/razorpay');
    for (const method of ['createOrder', 'createRefund', 'fetchOrderState', 'fetchPaymentState']) spies.push(jest.spyOn(provider, method).mockImplementation(() => { throw new Error('Preview called provider'); }));
    spies.push(jest.spyOn(require('../src/modules/payments/reconciliation'), 'reconcile').mockImplementation(() => { throw new Error('Preview called reconciliation'); }));
    const response = await get();
    expect(response.status).toBe(200);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(prisma.$store)).toBe(before);
  });
});
