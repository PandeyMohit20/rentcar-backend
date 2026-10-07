'use strict';
const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');
const { renderPdf, pdfBlocker } = require('../src/modules/invoices/pdf');
const { invoiceData } = require('./helpers/phase7');
const fs = require('fs');
const path = require('path');
describe('Authoritative PDF invoices', () => {
  beforeEach(resetStore);
  it('allocates consecutive invoice numbers and rolls the financial year at IST midnight', async () => {
    const { nextInvoiceNumber } = require('../src/modules/invoices/number');
    const before = await nextInvoiceNumber(prisma, new Date('2027-03-31T18:29:59Z'));
    const next = await nextInvoiceNumber(prisma, new Date('2027-03-31T18:29:59Z'));
    const after = await nextInvoiceNumber(prisma, new Date('2027-03-31T18:30:00Z'));
    expect(before).toBe('RC2627000000001');
    expect(next).toBe('RC2627000000002');
    expect(after).toBe('RC2728000000001');
  });
  it('generates a real PDF from immutable data', async () => {
    const pdf = await renderPdf(invoiceData(), {
      bookingStatus: 'CANCELLED',
      paymentStatus: 'refunded',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);
  });
  it('includes PDFKit standard font assets in the Vercel Express function', () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    expect(vercel.functions['index.js'].includeFiles).toBe(
      'node_modules/pdfkit/js/standard-fonts/**',
    );
    expect(fs.existsSync(require.resolve('pdfkit/standard-fonts/Helvetica'))).toBe(true);
  });
  it('does not invent historical tax or missing seller details', () => {
    expect(pdfBlocker({})).toBe('INVOICE_HISTORICAL_SNAPSHOT_UNAVAILABLE');
    const i = invoiceData();
    i.snapshot.seller.gstin = null;
    expect(() => renderPdf(i)).toThrow('SELLER_GST_PROFILE_REQUIRED');
  });
  it('protects customer PDF ownership and admin permission', async () => {
    const user = await seedUser({ email: 'pdf-owner@example.test' });
    const other = await seedUser({ email: 'pdf-other@example.test' });
    const booking = await prisma.booking.create({
      data: { userId: user.id, status: 'CONFIRMED', paymentStatus: 'succeeded' },
    });
    await prisma.invoice.create({
      data: { ...invoiceData(), bookingId: booking.id, userId: user.id },
    });
    const app = createApp(),
      url = `/api/v1/bookings/${booking.id}/invoice/download`;
    expect((await request(app).get(url)).status).toBe(401);
    expect(
      (
        await request(app)
          .get(url)
          .set('Authorization', `Bearer ${signAccessToken({ sub: other.id, type: 'access' })}`)
      ).status,
    ).toBe(404);
    const own = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}`);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('application/pdf');
    expect(own.headers['cache-control']).toBe('private, no-store');
    const missingInvoice = await prisma.booking.create({
      data: { userId: user.id, status: 'CONFIRMED', paymentStatus: 'succeeded' },
    });
    expect(
      (
        await request(app)
          .get(`/api/v1/bookings/${missingInvoice.id}/invoice/download`)
          .set('Authorization', `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/admin/bookings/${booking.id}/invoice/download`)
          .set('Authorization', `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}`)
      ).status,
    ).toBe(403);
  });
});
module.exports = { invoiceData };
