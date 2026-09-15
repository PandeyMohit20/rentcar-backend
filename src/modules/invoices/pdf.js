'use strict';
const PDFDocument = require('pdfkit');
const { prisma } = require('../../config/database');
const { blocked } = require('../pricing/tax');

function pdfBlocker(invoice) {
  const s = invoice.snapshot;
  if (!s) return 'INVOICE_HISTORICAL_SNAPSHOT_UNAVAILABLE';
  if (s.financial?.taxMode === 'UAT_BYPASS') {
    if (!require('../../config/uatTax').isUatTaxBypass()) return 'UAT_TAX_BYPASS_DISABLED';
    if (s.seller?.gstin || s.seller?.gstRegistrationStatus || s.seller?.documentTitle !== 'UAT Receipt' || s.financial.tax?.totalTax !== 0 || s.financial.cess?.totalCess !== 0) return 'INVOICE_TAX_STATUS_MISMATCH';
    return null;
  }
  if (s.financial?.policyStatus !== 'confirmed') return 'TAX_POLICY_REQUIRES_BUSINESS_CONFIRMATION';
  if (s.financial.gstRegistrationStatus === 'UNREGISTERED') {
    if (
      s.seller?.gstRegistrationStatus !== 'UNREGISTERED' ||
      s.seller.gstin ||
      s.financial.tax?.type !== 'NOT_COLLECTED' ||
      s.financial.tax?.totalTax !== 0
    )
      return 'INVOICE_TAX_STATUS_MISMATCH';
    if (!s.seller.legalName || !s.seller.address || !s.seller.sellerState)
      return 'SELLER_IDENTITY_REQUIRED';
    if (
      !s.seller.documentApproved ||
      !s.seller.documentApprovalReference ||
      !s.seller.documentTitle ||
      /gst|tax\s*invoice/i.test(s.seller.documentTitle)
    )
      return 'UNREGISTERED_DOCUMENT_APPROVAL_REQUIRED';
    return null;
  }
  if (
    s.financial.version >= 2 &&
    (s.financial.gstRegistrationStatus !== 'REGISTERED' ||
      s.seller?.gstRegistrationStatus !== 'REGISTERED')
  )
    return 'INVOICE_TAX_STATUS_MISMATCH';
  if (!s.seller?.legalName || !s.seller?.address || !s.seller?.gstin || !s.seller?.sac)
    return 'SELLER_GST_PROFILE_REQUIRED';
  return null;
}
function renderPdf(invoice, lifecycle = {}) {
  const blocker = pdfBlocker(invoice);
  if (blocker) throw blocked(blocker);
  const s = invoice.snapshot,
    f = s.financial;
  const uat = f.taxMode === 'UAT_BYPASS';
  const unregistered = uat || f.gstRegistrationStatus === 'UNREGISTERED';
  const doc = new PDFDocument({
    size: 'A4',
    margin: 45,
    info: { Title: `RentCar invoice ${invoice.invoiceNumber}`, Author: 'RentCar' },
  });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const text = (value, size = 10) => {
    doc
      .fontSize(size)
      .fillColor('#263244')
      .text(String(value ?? 'Not provided'), 45, doc.y, { width: 505 });
    doc.moveDown(0.5);
  };
  const heading = (label) => {
    doc.moveDown();
    doc.font('Helvetica-Bold');
    text(label, 12);
    doc.font('Helvetica');
  };
  const money = (amount) => `${f.currency} ${Number(amount || 0).toFixed(2)}`;
  const date = (value) =>
    new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(value)) + ' IST';
  doc.font('Helvetica-Bold');
  text('RENTCAR', 25);
  text(unregistered ? s.seller.documentTitle : 'TAX INVOICE', 16);
  doc.font('Helvetica');
  text(`Invoice: ${invoice.invoiceNumber}`);
  text(`Invoice date: ${date(invoice.invoiceDate)}`);
  text(`Booking: ${s.bookingNumber}`);
  heading('Billed By');
  text(s.seller.legalName);
  text(s.seller.address);
  if (!unregistered) text(`GSTIN: ${s.seller.gstin} | SAC: ${s.seller.sac}`);
  else if (s.seller.sac) text(`Service classification: ${s.seller.sac}`);
  heading('Billed To');
  text(s.customer.name);
  text(s.customer.email);
  text(s.customer.billingAddress || 'Billing address not provided');
  heading('Booking / Vehicle Details');
  text(`${s.vehicle.brand} ${s.vehicle.model} | ${s.vehicle.registrationNumber}`);
  text(`Pickup: ${date(s.pickup)}`);
  text(`Return: ${date(s.return)}`);
  heading('Charges');
  for (const [label, amount] of [
    ['Rental Charges', f.rentalSubtotal],
    [unregistered ? 'Additional Charges' : 'Other Taxable Charges', f.additionalCharges],
    ...(unregistered ? [] : [['Taxable Value', f.taxableAmount]]),
    ...(unregistered
      ? []
      : f.tax.type === 'CGST_SGST'
        ? [
            [`CGST (${f.tax.cgstRate}%)`, f.tax.cgst],
            [`SGST (${f.tax.sgstRate}%)`, f.tax.sgst],
          ]
        : [[`IGST (${f.tax.igstRate}%)`, f.tax.igst]]),
    [
      unregistered
        ? 'Refundable Security Deposit'
        : 'Refundable Security Deposit (separate from taxable value)',
      f.securityDeposit,
    ],
    ['Grand Total', f.grandTotal],
  ]) {
    if (doc.y > 720) doc.addPage();
    doc.font(label === 'Grand Total' ? 'Helvetica-Bold' : 'Helvetica');
    const y = doc.y;
    doc.fontSize(10).text(label, 45, y, { width: 365 });
    const after = doc.y;
    doc.text(money(amount), 415, y, { width: 135, align: 'right' });
    doc.y = Math.max(after, doc.y) + 9;
  }
  heading('Payment Information');
  text(
    `Payment: ${lifecycle.paymentStatus || 'succeeded'} | Booking: ${lifecycle.bookingStatus || 'CONFIRMED'}`,
  );
  if (lifecycle.paymentReference) text(`Reference: ${lifecycle.paymentReference}`);
  if (lifecycle.bookingStatus === 'CANCELLED')
    text(
      lifecycle.paymentStatus === 'refunded'
        ? 'Booking cancelled. Refund processed. This invoice remains on record.'
        : 'Booking cancelled. Refer to booking details for the current refund status.',
    );
  if (s.seller.supportEmail) text(`Contact: ${s.seller.supportEmail}`);
  if (s.seller.supportPhone) text(`Phone: ${s.seller.supportPhone}`);
  if (!unregistered)
    text(`Place of supply state: ${f.placeOfSupplyState}. Policy version: ${f.policyVersion}.`);
  else text(uat ? 'UAT ONLY - Not a tax invoice. No business tax approval recorded.' : `Policy version: ${f.policyVersion}.`);
  doc.end();
  return result;
}
async function download(bookingId, userId, admin = false) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...(admin ? {} : { userId }) },
  });
  if (!booking) return null;
  const invoice = await prisma.invoice.findUnique({ where: { bookingId } });
  if (!invoice) return null;
  const payment = await prisma.payment.findFirst({
    where: { bookingId, status: { in: ['succeeded', 'refunded'] } },
  });
  return {
    invoice,
    buffer: await renderPdf(invoice, {
      bookingStatus: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentReference: payment?.providerPaymentId,
    }),
  };
}
module.exports = { pdfBlocker, renderPdf, download };
