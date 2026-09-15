'use strict';
const { calculateTax } = require('../../src/modules/pricing/tax');
function invoiceData() {
  return {
    invoiceNumber: 'INV-PDF-TEST',
    invoiceDate: new Date(),
    snapshot: {
      bookingNumber: 'BK-PDF',
      pickup: '2027-01-10T00:00:00Z',
      return: '2027-01-11T00:00:00Z',
      seller: {
        gstRegistrationStatus: 'REGISTERED',
        legalName: 'Fixture Seller',
        address: 'Fixture address',
        gstin: '27AAAAA0000A1Z5',
        sac: '999999',
      },
      customer: {
        name: 'Fixture Customer',
        email: 'pdf@example.test',
        billingAddress: 'Fixture billing address',
      },
      vehicle: { brand: 'Toyota', model: 'Camry', registrationNumber: 'TEST-ONLY' },
      financial: calculateTax({
        recipient: { registrationStatus: 'unregistered', hasAddressOnRecord: false },
        rentalSubtotal: 100,
        securityDeposit: 500,
        policy: {
          gstRegistrationStatus: 'REGISTERED',
          approved: true,
          version: 'test',
          gstRateBps: 1800,
          sellerState: '27',
          placeOfSupplyRule: 'igst_section_12_2',
          depositTreatment: 'refundable_not_consideration',
          legalName: 'Fixture Seller',
          address: 'Fixture address',
          gstin: '27AAAAA0000A1Z5',
          sac: '999999',
        },
      }),
    },
  };
}

module.exports = { invoiceData };
