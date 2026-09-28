'use strict';
const crypto = require('crypto');

async function settlementFixture(db, options = {}) {
  const tag = crypto.randomUUID();
  const user = await db.user.create({ data: { name: 'Settlement test', email: `${tag}@example.test`, passwordHash: 'test-only', status: 'active' } });
  const vendor = await db.vendor.create({ data: { vendorCode: tag, companyName: 'Settlement test', status: 'active', commissionRate: '99.00' } });
  const city = await db.city.create({ data: { name: 'Settlement test', status: 'active' } });
  const location = await db.location.create({ data: { cityId: city.id, vendorId: vendor.id, name: 'Test', status: 'active' } });
  const branch = await db.branch.create({ data: { locationId: location.id, vendorId: vendor.id, name: 'Test', status: 'active' } });
  const car = await db.car.create({ data: { vendorId: vendor.id, branchId: branch.id, registrationNumber: tag, brand: 'Test', model: 'Test', manufacturingYear: 2025, status: 'available' } });
  const booking = await db.booking.create({ data: {
    bookingNumber: `BK-${tag}`, userId: user.id, vendorId: vendor.id, carId: car.id,
    startAt: new Date('2026-01-01'), endAt: new Date('2026-01-02'), status: 'COMPLETED', paymentStatus: 'succeeded',
    subtotal: '35200.00', tax: '6336.00', discount: '0.00', securityDeposit: '10000.00', totalAmount: '51536.00',
    vendorCommissionRate: '10.00', vendorCommision: '3520.00', currencyCode: 'INR',
    financialSnapshot: { version: 2, policyStatus: 'confirmed', policyVersion: 'approved-v1',
      currency: 'INR', rentalSubtotal: '35200.00', additionalCharges: 0, taxableAmount: '35200.00',
      tax: { type: 'IGST', rate: 18, igstRate: 18, cgstRate: 0, sgstRate: 0, cgst: 0, sgst: 0, igst: '6336.00', totalTax: '6336.00' },
      securityDeposit: '10000.00', grandTotal: '51536.00', depositTreatment: 'refundable_not_consideration',
      gstRegistrationStatus: 'REGISTERED', sellerState: '27', placeOfSupplyState: '29',
      placeOfSupplyDetermination: { rule: 'igst_section_12_2', registrationStatus: 'registered', source: 'registered_recipient_location', state: '29' },
    },
    billingSnapshot: { seller: { legalName: 'Test seller', address: 'Test address', gstRegistrationStatus: 'REGISTERED', gstin: '27ABCDE1234F1Z5', sellerState: '27', sac: '997311' } },
    ...options,
  } });
  const payment = await db.payment.create({ data: { bookingId: booking.id, userId: user.id,
    amount: booking.totalAmount, currencyCode: booking.currencyCode, provider: 'razorpay', providerOrderId: `order_${tag}`,
    providerPaymentId: `pay_${tag}`, status: 'succeeded', operationalStatus: 'normal', paidAt: new Date('2026-01-01') } });
  const trip = await db.tripHistory.create({ data: { bookingId: booking.id, tripStatus: 'archived', startTime: new Date('2026-01-01'),
    endTime: new Date('2026-01-02'), startOdometer: 0, endOdometer: 100, actualDistance: 100, completedBy: user.id } });
  return { user, vendor, car, booking, payment, trip, actor: { sub: user.id, permissions: ['admin.all'] } };
}

module.exports = { settlementFixture };
