'use strict';

async function billingSnapshot(db, userId, vendorId, car, uatBypass = false) {
  const [user, vendor, address] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.vendor.findUnique({
      where: { id: vendorId },
      select: { legalName: true, companyName: true, gstin: true, taxProfile: true },
    }),
    db.address.findFirst({ where: { userId, isDefault: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  if (uatBypass && !require('../../config/uatTax').isUatTaxBypass()) throw require('../pricing/tax').blocked('UAT_TAX_BYPASS_DISABLED');
  const policy = uatBypass ? null : vendor?.taxProfile;
  return {
    seller: {
      legalName: policy?.legalName || vendor?.legalName || null,
      address: policy?.address || null,
      gstRegistrationStatus: policy?.gstRegistrationStatus || null,
      gstin: policy?.gstRegistrationStatus === 'UNREGISTERED' ? null : policy?.gstin || null,
      sellerState: policy?.sellerState || null,
      state: policy?.state || null,
      documentTitle: uatBypass ? 'UAT Receipt' : policy?.documentTitle || null,
      documentApproved: policy?.documentApproved || false,
      documentApprovalReference: policy?.documentApprovalReference || null,
      sac: policy?.sac || null,
      supportEmail: policy?.supportEmail || null,
      supportPhone: policy?.supportPhone || null,
    },
    customer: {
      name: user?.name || null,
      email: user?.email || null,
      billingAddress: address
        ? [
            address.addressLine1,
            address.addressLine2,
            address.city,
            address.state,
            address.postalCode,
            address.country,
          ]
            .filter(Boolean)
            .join(', ')
        : null,
    },
    vehicle: {
      brand: car?.brand || null,
      model: car?.model || null,
      registrationNumber: car?.registrationNumber || null,
    },
  };
}
function invoiceSnapshot(booking) {
  if (!booking.financialSnapshot || !booking.billingSnapshot) return null;
  return {
    version: 1,
    bookingNumber: booking.bookingNumber,
    pickup: new Date(booking.startAt).toISOString(),
    return: new Date(booking.endAt).toISOString(),
    financial: booking.financialSnapshot,
    ...booking.billingSnapshot,
  };
}
module.exports = { billingSnapshot, invoiceSnapshot };
