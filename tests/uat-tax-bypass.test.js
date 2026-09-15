'use strict';
// Automated isolated tests, never live UAT evidence.
jest.mock('../src/modules/payments/providers/razorpay', () => ({
  createOrder: jest.fn(),
  parseWebhookEvent: jest.fn(),
}));
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { env } = require('../src/config/env');
const { isUatTaxBypass } = require('../src/config/uatTax');
const { createTrustedQuote } = require('../src/modules/pricing/service');
const { createBooking } = require('../src/modules/bookings/service');
const payments = require('../src/modules/payments/service');
const provider = require('../src/modules/payments/providers/razorpay');
const { pdfBlocker, renderPdf } = require('../src/modules/invoices/pdf');
const PDFDocument = require('pdfkit');
const original = { ...env };
let user, vendor;
const input = {
  carId: 'uat-car',
  pickupDateTime: '2030-09-22T10:00:00+05:30',
  returnDateTime: '2030-09-23T10:00:00+05:30',
};
beforeEach(async () => {
  resetStore();
  jest.clearAllMocks();
  Object.assign(env, original, {
    NODE_ENV: 'development',
    BYPASS_TAX_APPROVAL_FOR_UAT: 'true',
    RAZORPAY_KEY_ID: 'rzp_test_local',
  });
  user = await seedUser({ email: 'uat-isolated@example.test' });
  vendor = await prisma.vendor.create({
    data: { status: 'active', isDeleted: false, taxProfile: null, gstin: 'legacy-not-to-use' },
  });
  await prisma.car.create({
    data: {
      id: input.carId,
      vendorId: vendor.id,
      branchId: 'test-branch',
      status: 'available',
      isDeleted: false,
    },
  });
  await prisma.carPricing.create({
    data: {
      carId: input.carId,
      status: 'active',
      currencyCode: 'INR',
      dailyPrice: 2100,
      securityDeposit: 3500,
    },
  });
  await prisma.setting.create({
    data: {
      key: 'billing.issuer.phase7b.pending',
      value: JSON.stringify({ status: 'PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION' }),
      isActive: false,
    },
  });
});
afterEach(() => {
  Object.assign(env, original);
  jest.restoreAllMocks();
});
it.each([
  ['development', 'true', true],
  ['development', 'false', false],
  ['production', 'true', false],
  ['production', 'false', false],
])('environment %s flag %s permits bypass %s', async (mode, flag, expected) => {
  Object.assign(env, { NODE_ENV: mode, BYPASS_TAX_APPROVAL_FOR_UAT: flag });
  expect(isUatTaxBypass()).toBe(expected);
  if (expected)
    expect((await createTrustedQuote(input)).financialSnapshot.taxMode).toBe('UAT_BYPASS');
  else await expect(createTrustedQuote(input)).rejects.toThrow('PARTIALLY_APPROVED');
});
it('preserves pricing, expiry, availability, idempotency and approval state', async () => {
  const update = jest.spyOn(prisma.vendor, 'update');
  const audit = jest.spyOn(prisma.auditLog, 'create');
  const q = await createTrustedQuote(input);
  expect(q.financialSnapshot).toMatchObject({
    taxMode: 'UAT_BYPASS',
    gstRegistrationStatus: null,
    policyStatus: 'uat_bypass',
    rentalSubtotal: 2100,
    grandTotal: 5600,
    tax: { totalTax: 0 },
    cess: { totalCess: 0 },
  });
  expect(q.financialSnapshot.tax).not.toHaveProperty('rate');
  const req = { userId: user.id, quoteToken: q.quoteToken, idempotencyKey: 'uat-booking' };
  const first = await createBooking(req);
  expect((await createBooking(req)).booking.id).toBe(first.booking.id);
  await expect(createTrustedQuote(input)).rejects.toThrow(/available/);
  jest.spyOn(Date, 'now').mockReturnValue(new Date(q.expiresAt).getTime() + 1000);
  await expect(createBooking({ ...req, idempotencyKey: 'expired' })).rejects.toThrow();
  expect(update).not.toHaveBeenCalled();
  expect(audit).not.toHaveBeenCalled();
  expect((await prisma.vendor.findUnique({ where: { id: vendor.id } })).taxProfile).toBeNull();
  expect(
    JSON.parse(
      (await prisma.setting.findUnique({ where: { key: 'billing.issuer.phase7b.pending' } })).value,
    ).status,
  ).toContain('PARTIALLY_APPROVED');
});
it('rejects UAT quotes when disabled or moved to production', async () => {
  const q = await createTrustedQuote(input);
  for (const mode of ['development', 'production']) {
    Object.assign(env, {
      NODE_ENV: mode,
      BYPASS_TAX_APPROVAL_FOR_UAT: mode === 'production' ? 'true' : 'false',
    });
    await expect(
      createBooking({ userId: user.id, quoteToken: q.quoteToken, idempotencyKey: 'off' }),
    ).rejects.toThrow('UAT quote is disabled');
  }
});
it('uses exact backend payment amount, retains capture validation and generates only a UAT receipt', async () => {
  const q = await createTrustedQuote({ ...input, userId: user.id });
  expect(q.financialSnapshot.grandTotal).toBe(5600);
  const { booking } = await createBooking({
    userId: user.id,
    quoteToken: q.quoteToken,
    idempotencyKey: 'pay',
  });
  env.RAZORPAY_KEY_ID = 'rzp_live_not_real';
  await expect(payments.createOrder({ userId: user.id, bookingId: booking.id })).rejects.toThrow(
    'TEST credentials',
  );
  env.RAZORPAY_KEY_ID = 'rzp_test_local';
  provider.createOrder.mockResolvedValue({ id: 'order_uat' });
  await payments.createOrder({ userId: user.id, bookingId: booking.id });
  expect(provider.createOrder).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 560000, currency: 'INR' }),
  );
  provider.parseWebhookEvent.mockImplementation(JSON.parse);
  const raw = (amount) =>
    JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_uat', order_id: 'order_uat', amount, currency: 'INR' } },
      },
    });
  await payments.processWebhook({ eventId: 'wrong', rawBody: raw(1) });
  expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).not.toBe(
    'CONFIRMED',
  );
  // A separate correctly paid booking is exercised by existing lifecycle tests.
  const persisted = await prisma.booking.findUnique({ where: { id: booking.id } });
  const snapshot = require('../src/modules/invoices/snapshot').invoiceSnapshot(persisted);
  const invoice = { snapshot, invoiceNumber: 'UAT-local', invoiceDate: new Date() };
  expect(snapshot.seller.gstin).toBeNull();
  expect(pdfBlocker(invoice)).toBeNull();
  const spy = jest.spyOn(PDFDocument.prototype, 'text');
  await renderPdf(invoice);
  const text = spy.mock.calls.map((x) => String(x[0])).join('\n');
  expect(text).toContain('UAT Receipt');
  expect(text).not.toMatch(/GSTIN:|CGST|SGST|IGST|TAX INVOICE/);
  env.NODE_ENV = 'production';
  expect(pdfBlocker(invoice)).toBe('UAT_TAX_BYPASS_DISABLED');
});
it('valid capture preserves quote, booking, payment and persisted receipt totals', async () => {
 const q=await createTrustedQuote({...input,userId:user.id});
 const {booking}=await createBooking({userId:user.id,quoteToken:q.quoteToken,idempotencyKey:'capture'});
 provider.createOrder.mockResolvedValue({id:'order_success'});
 const order=await payments.createOrder({userId:user.id,bookingId:booking.id});
 provider.parseWebhookEvent.mockImplementation(JSON.parse);
 const rawBody=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_success',order_id:'order_success',amount:560000,currency:'INR'}}}});
 await payments.processWebhook({eventId:'capture-success',rawBody});
 const invoice=await prisma.invoice.findUnique({where:{bookingId:booking.id}});
 expect(Number(order.payment.amount)).toBe(q.financialSnapshot.grandTotal);
 expect(Number(invoice.total)).toBe(q.financialSnapshot.grandTotal);
 expect(invoice.snapshot.financial.taxMode).toBe('UAT_BYPASS');
 expect(invoice.snapshot.seller.gstin).toBeNull();
 expect(pdfBlocker(invoice)).toBeNull();
 await payments.processWebhook({eventId:'capture-duplicate',rawBody});
 expect((await prisma.invoice.findMany({where:{bookingId:booking.id}}))).toHaveLength(1);
 env.NODE_ENV='production';
 expect(await require('../src/modules/invoices/service').ensureForPaidBooking(prisma,{...booking,status:'CONFIRMED'},{status:'succeeded'})).toBeNull();
});
