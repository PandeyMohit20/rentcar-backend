'use strict';
const { calculateTax, paise } = require('../src/modules/pricing/tax');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { createTrustedQuote, verifyQuote } = require('../src/modules/pricing/service');
const { createBooking } = require('../src/modules/bookings/service');
const { ensureForPaidBooking } = require('../src/modules/invoices/service');
const { minorUnits } = require('../src/modules/payments/service');
const policy = {
  approved: true,
  version: 'test-only-1',
  gstRateBps: 1800,
  sellerState: '27',
  placeOfSupplyRule: 'igst_section_12_2',
  depositTreatment: 'refundable_not_consideration',
  legalName: 'Test Seller',
  address: 'Test invoice address',
  gstin: '27AAAAA0000A1Z5',
  sac: '999999',
};
const calculate = (overrides = {}) =>
  calculateTax({
    rentalSubtotal: '100.00',
    securityDeposit: '500.00',
    currency: 'INR',
    policy,
    recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: true, state: '27' },
    ...overrides,
  });
describe('Central tax calculation', () => {
  it('splits intrastate GST and excludes refundable deposit', () => {
    expect(calculate()).toMatchObject({
      taxableAmount: 100,
      securityDeposit: 500,
      grandTotal: 618,
      tax: { cgst: 9, sgst: 9, igst: 0, totalTax: 18 },
    });
  });
  it('uses IGST for a different approved place of supply', () => {
    expect(
      calculate({
        recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: true, state: '29' },
      }).tax,
    ).toMatchObject({
      type: 'IGST',
      cgst: 0,
      sgst: 0,
      igst: 18,
    });
  });
  it('includes taxable additional charges', () =>
    expect(calculate({ additionalCharges: 100 }).grandTotal).toBe(736));
  it('distinguishes approved zero rating from missing policy', () => {
    expect(calculate({ policy: { ...policy, gstRateBps: 0 } })).toMatchObject({
      policyStatus: 'confirmed',
      grandTotal: 600,
    });
    expect(calculate({ policy: null })).toMatchObject({
      policyStatus: 'TAX_POLICY_REQUIRES_BUSINESS_CONFIRMATION',
      taxableAmount: null,
      grandTotal: 600,
    });
  });
  it('rounds each component half-up at paise precision', () => {
    expect(calculate({ rentalSubtotal: '0.06', securityDeposit: 0 }).tax).toMatchObject({
      cgst: 0.01,
      sgst: 0.01,
      totalTax: 0.02,
    });
    expect(
      calculate({
        rentalSubtotal: '0.06',
        securityDeposit: 0,
        recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: true, state: '29' },
      }).tax.totalTax,
    ).toBe(0.01);
  });
  it.each(['1.001', '-1', 'NaN', '1e10'])('rejects unrepresentable money %s', (value) =>
    expect(() => paise(value)).toThrow(),
  );
  it('requires approved policy, matching GST state and place of supply', () => {
    expect(() => calculate({ policy: { ...policy, approved: false } })).toThrow(
      'TAX_POLICY_CONFIGURATION_INVALID',
    );
    expect(() => calculate({ policy: { ...policy, sellerState: '29' } })).toThrow();
    expect(() =>
      calculate({
        recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: true, state: null },
      }),
    ).toThrow('CUSTOMER_BILLING_STATE_REQUIRED');
  });
});
describe('Quote to invoice tax immutability', () => {
  beforeEach(resetStore);
  it('protects tax and customer binding, snapshots old prices and preserves payment paise', async () => {
    const user = await seedUser({ email: 'tax-fixture@example.test' });
    await prisma.setting.create({
      data: {
        key: 'billing.recipient.' + user.id,
        value: JSON.stringify({ registrationStatus: 'unregistered' }),
        isActive: true,
      },
    });
    const vendor = await prisma.vendor.create({
      data: {
        taxProfile: {
          ...policy,
          vehicleRates: [
            { vehicleId: 'tax-car', approved: true, gstRateBps: 1800, cessRateBps: 0 },
          ],
        },
        companyName: 'Test Seller',
      },
    });
    await prisma.address.create({
      data: { userId: user.id, isDefault: true, state: '27', addressLine1: 'Test billing address' },
    });
    const car = await prisma.car.create({
      data: {
        id: 'tax-car',
        vendorId: vendor.id,
        branchId: 'branch',
        status: 'available',
        isDeleted: false,
        brand: 'Test',
        model: 'Car',
      },
    });
    await prisma.carPricing.create({
      data: {
        carId: car.id,
        dailyPrice: 100,
        securityDeposit: 500,
        status: 'active',
        currencyCode: 'INR',
      },
    });
    const quote = await createTrustedQuote({
      carId: car.id,
      userId: user.id,
      pickupDateTime: '2027-01-10T00:00:00Z',
      returnDateTime: '2027-01-11T00:00:00Z',
    });
    const decoded = verifyQuote(quote.quoteToken);
    expect(decoded.financialSnapshot.grandTotal).toBe(618);
    const parts = quote.quoteToken.split('.');
    const tampered = {
      ...decoded,
      payableAmount: 1,
      financialSnapshot: { ...decoded.financialSnapshot, grandTotal: 1 },
    };
    parts[1] = Buffer.from(JSON.stringify(tampered)).toString('base64url');
    expect(() => verifyQuote(parts.join('.'))).toThrow();
    await expect(
      createBooking({
        userId: 'someone-else',
        quoteToken: quote.quoteToken,
        idempotencyKey: 'wrong',
      }),
    ).rejects.toThrow('another customer');
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { taxProfile: { ...policy, gstRateBps: 2800, legalName: 'Changed seller' } },
    });
    const result = await createBooking({
      userId: user.id,
      quoteToken: quote.quoteToken,
      idempotencyKey: 'snapshot-test',
    });
    const booking = await prisma.booking.findUnique({ where: { id: result.booking.id } });
    expect(booking).toMatchObject({
      totalAmount: 618,
      tax: 18,
      billingSnapshot: { seller: { legalName: 'Test Seller' } },
    });
    expect(minorUnits(booking.totalAmount)).toBe(61800);
    const confirmed = { ...booking, status: 'CONFIRMED' };
    const invoice = await ensureForPaidBooking(prisma, confirmed, { status: 'succeeded' });
    expect(invoice.snapshot.financial).toEqual(decoded.financialSnapshot);
    expect(invoice.invoiceNumber).toMatch(/^RC[0-9]{13}$/);
    expect(invoice.invoiceNumber.length).toBeLessThanOrEqual(16);
    expect((await ensureForPaidBooking(prisma, confirmed, { status: 'succeeded' })).id).toBe(
      invoice.id,
    );
  });
});
module.exports = { policy };

describe('Approved Section 12(2) determination and rate guards', () => {
  const { determinePlaceOfSupply, selectVehiclePolicy } = require('../src/modules/pricing/tax');
  it.each([
    ['registered', true, '29', 'registered_recipient_location', '29'],
    ['unregistered', true, '29', 'recipient_address_on_record', '29'],
    ['unregistered', false, undefined, 'supplier_location', '27'],
  ])(
    'preserves the %s recipient determination',
    (registrationStatus, hasAddressOnRecord, state, source, expected) => {
      expect(
        determinePlaceOfSupply({
          sellerState: '27',
          recipient: { registrationStatus, hasAddressOnRecord, state },
        }),
      ).toMatchObject({ state: expected, source, rule: 'igst_section_12_2' });
    },
  );
  it('does not treat unknown registration or an incomplete address as supplier location', () => {
    expect(() => determinePlaceOfSupply({ sellerState: '27' })).toThrow(
      'RECIPIENT_TAX_STATUS_REQUIRED',
    );
    expect(() =>
      determinePlaceOfSupply({
        sellerState: '27',
        recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: true },
      }),
    ).toThrow('CUSTOMER_BILLING_STATE_REQUIRED');
  });
  it('selects a vehicle override before a category and rejects missing approval or nonzero cess', () => {
    const profile = {
      ...policy,
      vehicleRates: [
        { categoryId: 'c', approved: true, gstRateBps: 1200, cessRateBps: 0 },
        { vehicleId: 'v', approved: true, gstRateBps: 2800, cessRateBps: 0 },
      ],
    };
    expect(selectVehiclePolicy(profile, { id: 'v', categoryId: 'c' }).gstRateBps).toBe(2800);
    expect(selectVehiclePolicy(profile, { id: 'other', categoryId: 'c' }).gstRateBps).toBe(1200);
    expect(() => selectVehiclePolicy(profile, { id: 'other' })).toThrow(
      'VEHICLE_GST_AND_CESS_APPROVAL_REQUIRED',
    );
    profile.vehicleRates[1].cessRateBps = 100;
    expect(() => selectVehiclePolicy(profile, { id: 'v' })).toThrow(
      'APPROVED_CESS_IMPLEMENTATION_REQUIRED',
    );
  });
});

describe('Partial business approval blocks live quotes', () => {
  beforeEach(resetStore);
  it('cannot issue a quote while GST and cess approval is missing', async () => {
    await prisma.setting.create({
      data: {
        key: 'billing.issuer.phase7b.pending',
        value: JSON.stringify({ status: 'PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION' }),
      },
    });
    await prisma.car.create({
      data: { id: 'blocked-car', vendorId: 'vendor', status: 'available', isDeleted: false },
    });
    await prisma.carPricing.create({
      data: {
        carId: 'blocked-car',
        dailyPrice: 100,
        securityDeposit: 500,
        status: 'active',
        currencyCode: 'INR',
      },
    });
    await expect(
      createTrustedQuote({
        carId: 'blocked-car',
        pickupDateTime: '2027-01-10T00:00:00Z',
        returnDateTime: '2027-01-11T00:00:00Z',
      }),
    ).rejects.toThrow('PARTIALLY_APPROVED_REQUIRES_RATE_AND_CESS_CONFIRMATION');
  });
});
