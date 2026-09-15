'use strict';
// Isolated code tests only: no live DB, provider payments, or approval data.
jest.mock('../src/modules/payments/providers/razorpay', () => ({
  createOrder: jest.fn(),
  createRefund: jest.fn(),
  verifyCheckoutSignature: jest.fn(),
  parseWebhookEvent: jest.fn(),
}));
const PDFDocument = require('pdfkit');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const {
  policySchema,
  vehicleProfileSchema,
  selectVehiclePolicy,
  calculateTax,
} = require('../src/modules/pricing/tax');
const {
  review,
  complete,
  saveProfile,
  PENDING,
} = require('../src/modules/billingApproval/service');
const { createTrustedQuote } = require('../src/modules/pricing/service');
const { createBooking, cancelBooking } = require('../src/modules/bookings/service');
const paymentService = require('../src/modules/payments/service');
const provider = require('../src/modules/payments/providers/razorpay');
const { renderPdf, pdfBlocker } = require('../src/modules/invoices/pdf');
const { invoiceData } = require('./helpers/phase7');
const unregistered = {
  gstRegistrationStatus: 'UNREGISTERED',
  approved: true,
  version: 'local-test-unregistered',
  legalName: 'Local Test Seller',
  address: 'Local Test Address',
  sellerState: '27',
  placeOfSupplyRule: 'not_applicable',
  depositTreatment: 'refundable_not_consideration',
  unregisteredPolicyConfirmed: true,
  documentTitle: 'Rental Receipt - LOCAL TEST',
  documentApproved: true,
  documentApprovalReference: 'LOCAL TEST DOCUMENT DECISION',
  gstCollection: 'not_collected',
  cessTreatment: 'not_collected',
};
const registered = {
  gstRegistrationStatus: 'REGISTERED',
  approved: true,
  version: 'local-test-registered',
  legalName: 'Local Test Seller',
  address: 'Local Test Address',
  sellerState: '27',
  gstin: '27AAAAA0000A1Z5',
  sac: '999999',
  placeOfSupplyRule: 'igst_section_12_2',
  depositTreatment: 'refundable_not_consideration',
  gstRateBps: 1800,
};
function profile(policy = unregistered) {
  const result = { ...policy };
  delete result.gstCollection;
  delete result.cessTreatment;
  delete result.gstRateBps;
  result.vehicleRates = [
    {
      vehicleId: 'registration-test-car',
      approved: true,
      ...(policy.gstRegistrationStatus === 'REGISTERED'
        ? { gstRateBps: policy.gstRateBps, cessRateBps: 0 }
        : { gstCollection: 'not_collected', cessTreatment: 'not_collected' }),
    },
  ];
  return result;
}
const totals = (policy) =>
  calculateTax({
    rentalSubtotal: 100,
    additionalCharges: 20,
    securityDeposit: 500,
    policy,
    recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: false },
  });
describe('Explicit seller registration policy', () => {
  it('accepts absent/null GSTIN for explicitly approved unregistered policy', () => {
    expect(policySchema.safeParse(unregistered).success).toBe(true);
    expect(policySchema.safeParse({ ...unregistered, gstin: null }).success).toBe(true);
    expect(vehicleProfileSchema.safeParse(profile()).success).toBe(true);
  });
  it.each([
    'gstRegistrationStatus',
    'approved',
    'version',
    'unregisteredPolicyConfirmed',
    'gstCollection',
    'cessTreatment',
    'documentTitle',
    'documentApproved',
    'documentApprovalReference',
  ])('requires explicit unregistered %s', (key) => {
    const p = { ...unregistered };
    delete p[key];
    expect(policySchema.safeParse(p).success).toBe(false);
  });
  it.each([
    { gstin: registered.gstin },
    { gstRateBps: 0 },
    { cessRateBps: 0 },
    { documentTitle: 'GST TAX INVOICE' },
  ])('rejects incompatible unregistered fields %j', (fields) => {
    expect(policySchema.safeParse({ ...unregistered, ...fields }).success).toBe(false);
  });
  it('does not infer status from a valid GSTIN', () => {
    const p = { ...registered };
    delete p.gstRegistrationStatus;
    expect(() => totals(p)).toThrow('GST_REGISTRATION_STATUS_REQUIRED');
  });
  it('keeps registered GSTIN and rate validation conditional and strict', () => {
    for (const field of ['gstin', 'gstRateBps']) {
      const p = { ...registered };
      delete p[field];
      expect(policySchema.safeParse(p).success).toBe(false);
    }
    expect(policySchema.safeParse({ ...registered, gstin: 'invalid' }).success).toBe(false);
    expect(policySchema.safeParse({ ...registered, sellerState: '29' }).success).toBe(false);
    expect(totals(registered).tax).toMatchObject({ type: 'CGST_SGST', totalTax: 21.6 });
    expect(totals({ ...registered, gstRateBps: 0 })).toMatchObject({
      gstRegistrationStatus: 'REGISTERED',
      tax: { type: 'CGST_SGST', totalTax: 0 },
    });
  });
  it('does not add GST or invent a zero-percent rate for unregistered sellers', () => {
    expect(totals(unregistered)).toMatchObject({
      gstRegistrationStatus: 'UNREGISTERED',
      grandTotal: 620,
      taxableAmount: null,
      tax: { type: 'NOT_COLLECTED', totalTax: 0 },
      cess: { treatment: 'not_collected' },
    });
    expect(totals(unregistered).tax).not.toHaveProperty('rate');
    expect(totals(unregistered).tax).not.toHaveProperty('cgst');
  });
  it('rejects retained numeric tax decisions and preserves registered CESS restrictions', () => {
    const p = profile();
    p.vehicleRates[0].gstRateBps = 1800;
    expect(() => selectVehiclePolicy(p, { id: 'registration-test-car' })).toThrow(
      'TAX_POLICY_CONFIGURATION_INVALID',
    );
    const r = profile(registered);
    r.vehicleRates[0].cessRateBps = 100;
    expect(() => selectVehiclePolicy(r, { id: 'registration-test-car' })).toThrow(
      'APPROVED_CESS_IMPLEMENTATION_REQUIRED',
    );
  });
});

describe('Registration lifecycle and trusted amounts (local test store)', () => {
  let user, vendor;
  beforeEach(async () => {
    resetStore();
    jest.clearAllMocks();
    user = await seedUser({ email: 'registration-local@example.test', roles: ['SUPER_ADMIN'] });
    vendor = await prisma.vendor.create({
      data: { status: 'active', isDeleted: false, taxProfile: profile(), gstin: registered.gstin },
    });
    await prisma.car.create({
      data: {
        id: 'registration-test-car',
        vendorId: vendor.id,
        branchId: 'test-branch',
        status: 'available',
        isDeleted: false,
      },
    });
    await prisma.carPricing.create({
      data: {
        carId: 'registration-test-car',
        status: 'active',
        currencyCode: 'INR',
        dailyPrice: 100,
        securityDeposit: 500,
      },
    });
    await prisma.setting.create({
      data: {
        key: 'billing.issuer.phase7b.pending',
        value: JSON.stringify({ status: PENDING }),
        isActive: false,
      },
    });
  });
  const approve = async () => {
    const input = {
      reviewHash: (await review()).reviewHash,
      idempotencyKey: 'f1d722ae-ff25-4bad-bd91-0ca125bdf9c2',
      rateConfirmed: true,
      cessConfirmed: true,
      taxConfirmed: true,
      globalScopeConfirmed: true,
      rateApprovalReference: 'LOCAL TEST',
      cessApprovalReference: 'LOCAL TEST',
      commercialStructureApprovalReference: 'LOCAL TEST',
    };
    await complete(input, user.id);
    return input;
  };
  const quote = () =>
    createTrustedQuote({
      carId: 'registration-test-car',
      userId: user.id,
      pickupDateTime: '2030-09-22T10:00:00+05:30',
      returnDateTime: '2030-09-23T10:00:00+05:30',
    });
  it('readiness distinguishes confirmed unregistered policy from missing decisions', async () => {
    const before = await review();
    expect(before.readiness.blockers.map((b) => b.code)).not.toEqual(
      expect.arrayContaining(['MISSING_GSTIN']),
    );
    expect(before.blocker).toBeNull();
    await approve();
    expect((await review()).readiness).toMatchObject({ status: 'READY', blockers: [] });
  });
  it('requires a new policy version for a registration change and audits registered to unregistered', async () => {
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { taxProfile: profile(registered) },
    });
    await approve();
    const r = await review();
    const input = {
      reviewHash: r.reviewHash,
      profile: { ...profile(), version: registered.version },
      decisionsConfirmed: true,
      businessApprovalReference: 'LOCAL TEST CHANGE',
    };
    await expect(saveProfile(vendor.id, input, user.id)).rejects.toThrow(
      'POLICY_VERSION_CHANGE_REQUIRED',
    );
    await saveProfile(vendor.id, { ...input, profile: profile() }, user.id);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'billing.tax-profile.save' },
    });
    expect(JSON.parse(audit.metadata)).toMatchObject({
      oldRegistrationStatus: 'REGISTERED',
      newRegistrationStatus: 'UNREGISTERED',
    });
    expect((await review()).configuration.status).toBe(PENDING);
  });
  it('audits status changes, reopens approval, rejects stale review and incompatible quotes', async () => {
    const previous = await approve();
    const q = await quote();
    const r = await review();
    await saveProfile(
      vendor.id,
      {
        reviewHash: r.reviewHash,
        profile: profile(registered),
        decisionsConfirmed: true,
        businessApprovalReference: 'LOCAL TEST STATUS DECISION',
      },
      user.id,
    );
    expect((await review()).configuration.status).toBe(PENDING);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'billing.tax-profile.save' },
    });
    expect(JSON.parse(audit.metadata)).toMatchObject({
      oldRegistrationStatus: 'UNREGISTERED',
      newRegistrationStatus: 'REGISTERED',
      version: 'local-test-registered',
    });
    await expect(complete(previous, user.id)).rejects.toThrow('BILLING_REVIEW_STALE');
    await expect(
      createBooking({ userId: user.id, quoteToken: q.quoteToken, idempotencyKey: 'stale-quote' }),
    ).rejects.toThrow('Seller tax status changed');
  });
  it('preserves quote -> booking -> order -> capture -> invoice -> full refund amounts', async () => {
    await approve();
    const q = await quote();
    expect(q.pricing.payableAmount).toBe(600);
    const created = await createBooking({
      userId: user.id,
      quoteToken: q.quoteToken,
      idempotencyKey: 'unregistered-booking',
    });
    const bookingId = created.booking.id;
    expect(created.booking).toMatchObject({ totalAmount: 600, tax: 0 });
    provider.createOrder.mockResolvedValue({ id: 'order_local_registration' });
    const order = await paymentService.createOrder({ userId: user.id, bookingId });
    expect(provider.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 60000, currency: 'INR' }),
    );
    expect(Number(order.payment.amount)).toBe(600);
    provider.verifyCheckoutSignature.mockReturnValue(true);
    await paymentService.verifyCheckout({
      userId: user.id,
      bookingId,
      orderId: 'order_local_registration',
      paymentId: 'pay_local_registration',
      signature: 'local-test',
    });
    provider.parseWebhookEvent.mockImplementation((raw) => JSON.parse(raw));
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_local_registration',
            order_id: 'order_local_registration',
            amount: 60000,
            currency: 'INR',
          },
        },
      },
    });
    await paymentService.processWebhook({ eventId: 'local-capture', rawBody: raw });
    const invoice = await prisma.invoice.findUnique({ where: { bookingId } });
    expect(Number(invoice.total)).toBe(600);
    expect(invoice.snapshot.seller.gstin).toBeNull(); // No fallback to legacy vendor GSTIN.
    expect(invoice.snapshot.financial).toEqual(q.financialSnapshot);
    const spy = jest.spyOn(PDFDocument.prototype, 'text');
    const pdf = await renderPdf(invoice);
    const text = spy.mock.calls.map((args) => String(args[0])).join('\n');
    spy.mockRestore();
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(text).toContain(unregistered.documentTitle);
    expect(text).not.toMatch(/GSTIN|CGST|SGST|IGST|TAX INVOICE|Taxable/);
    provider.createRefund.mockResolvedValue({
      id: 'refund_local',
      payment_id: 'pay_local_registration',
      amount: 60000,
      currency: 'INR',
      status: 'processed',
    });
    const cancelled = await cancelBooking({
      userId: user.id,
      bookingId,
      reason: 'Local test',
      idempotencyKey: 'local-refund',
    });
    expect(Number(cancelled.refund.amount)).toBe(600);
    expect(provider.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 60000 }),
    );
    expect(cancelled.booking.financialSnapshot).toEqual(q.financialSnapshot);
  });
  it('blocks unapproved or contradictory unregistered documents; preserves historical registered PDFs', () => {
    const i = invoiceData();
    i.snapshot.financial = totals(unregistered);
    i.snapshot.seller = { ...unregistered, gstin: null };
    expect(pdfBlocker(i)).toBeNull();
    i.snapshot.seller.documentApproved = false;
    expect(pdfBlocker(i)).toBe('UNREGISTERED_DOCUMENT_APPROVAL_REQUIRED');
    i.snapshot.seller.gstin = registered.gstin;
    expect(pdfBlocker(i)).toBe('INVOICE_TAX_STATUS_MISMATCH');
    const legacy = invoiceData();
    legacy.snapshot.financial.version = 1;
    delete legacy.snapshot.financial.gstRegistrationStatus;
    delete legacy.snapshot.seller.gstRegistrationStatus;
    expect(pdfBlocker(legacy)).toBeNull();
  });
});
