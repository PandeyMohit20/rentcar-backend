'use strict';
const crypto = require('crypto');
const { prisma } = require('../../config/database');
const { renderPdf, pdfBlocker } = require('../../modules/invoices/pdf');
const { emailService } = require('./email.service');

const titles = {
  booking_created: 'Booking created — payment pending',
  payment_failed: 'Payment attempt failed',
  booking_confirmed: 'Payment successful — booking confirmed',
  invoice_issued: 'Your RentCar invoice',
  booking_cancelled: 'Booking cancelled',
  refund_succeeded: 'Refund processed',
  refund_failed: 'Refund could not be processed',
};
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function template(eventType, data) {
  const money = (n) => `${data.currency} ${Number(n || 0).toFixed(2)}`;
  const date = (n) =>
    new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(n)) + ' IST';
  const lines = [
    `Hello ${data.name},`,
    `Booking: ${data.bookingNumber}`,
    `Vehicle: ${data.vehicle}`,
    `Pickup: ${date(data.pickup)}`,
    `Return: ${date(data.return)}`,
  ];
  if (eventType.startsWith('refund_')) lines.push(`Refund amount: ${money(data.refundAmount)}`);
  else lines.push(`Total: ${money(data.total)}`);
  if (data.financial)
    lines.push(
      `Rental: ${money(data.financial.rentalSubtotal)}`,
      `Tax: ${money(data.financial.tax.totalTax)}`,
      `Security deposit: ${money(data.financial.securityDeposit)}`,
    );
  const wording = {
    booking_created:
      'Your booking was created with payment pending. Complete payment only while its hold is valid.',
    payment_failed:
      'This payment attempt failed. Check the latest booking status before retrying; never retry an already paid booking.',
    booking_confirmed:
      'Your payment was captured and your booking was confirmed. Check your booking for its current status.',
    invoice_issued: `Invoice ${data.invoiceNumber} is attached.`,
    booking_cancelled: data.refundAmount
      ? 'Your booking was cancelled and a refund was initiated. This notice does not confirm that the refund has been processed.'
      : 'Your booking was cancelled. No captured payment was refundable at cancellation.',
    refund_succeeded: 'Your refund has been processed.',
    refund_failed:
      'Your refund could not be processed. Contact support with your booking number. This notice does not confirm a refund.',
  };
  lines.push(wording[eventType]);
  const subject = `${titles[eventType]} | ${data.bookingNumber}`;
  return {
    subject,
    text: lines.join('\n\n'),
    html: `<html><body style="font-family:Arial,sans-serif;color:#263244"><div style="max-width:640px;margin:24px auto;padding:24px;border:1px solid #dbe2ea"><h1>RENTCAR</h1><h2>${escape(titles[eventType])}</h2>${lines.map((line) => `<p>${escape(line)}</p>`).join('')}<hr><p>Keep your booking number for future correspondence.</p></div></body></html>`,
  };
}

async function enqueue(db, eventType, entityId, booking, data, recipient) {
  if (!recipient || !titles[eventType]) return null;
  const dedupeKey = crypto
    .createHash('sha256')
    .update(`${eventType}:${entityId}:${recipient.toLowerCase()}`)
    .digest('hex');
  if (await db.emailDelivery.findUnique({ where: { dedupeKey } })) return null;
  try {
    return await db.emailDelivery.create({
      data: {
        dedupeKey,
        bookingId: booking.id,
        eventType,
        recipient,
        payload: data,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    });
  } catch (err) {
    if (err.code === 'P2002') return null;
    throw err;
  }
}

// Reconcile committed facts instead of performing SMTP inside financial transactions.
// Repeated scans repair missed work after crashes; unique keys make projection durable.
async function projectBooking(booking, db = prisma) {
  const [user, car, payments, refunds, invoice, history] = await Promise.all([
    db.user.findUnique({ where: { id: booking.userId }, select: { name: true, email: true } }),
    db.car.findUnique({ where: { id: booking.carId }, select: { brand: true, model: true } }),
    db.payment.findMany({ where: { bookingId: booking.id } }),
    db.refund.findMany({ where: { bookingId: booking.id } }),
    db.invoice.findUnique({ where: { bookingId: booking.id } }),
    db.bookingStatusHistory.findMany({ where: { bookingId: booking.id } }),
  ]);
  const data = {
    name: booking.billingSnapshot?.customer?.name || user?.name || 'Customer',
    bookingNumber: booking.bookingNumber,
    vehicle: [car?.brand, car?.model].filter(Boolean).join(' '),
    pickup: new Date(booking.startAt).toISOString(),
    return: new Date(booking.endAt).toISOString(),
    total: Number(booking.totalAmount),
    currency: booking.currencyCode,
    financial: booking.financialSnapshot || null,
  };
  const recipient = booking.billingSnapshot?.customer?.email || user?.email;
  await enqueue(db, 'booking_created', booking.id, booking, data, recipient);
  for (const payment of payments) {
    if (payment.failedAt && payment.status === 'failed')
      await enqueue(db, 'payment_failed', payment.id, booking, data, recipient);
  }
  if (history.some((h) => h.toStatus === 'CONFIRMED') && payments.some((p) => p.paidAt)) {
    await enqueue(
      db,
      'booking_confirmed',
      booking.id,
      booking,
      { ...data, invoiceId: invoice?.id || null },
      recipient,
    );
    const confirmation = await db.emailDelivery.findFirst({
      where: { bookingId: booking.id, eventType: 'booking_confirmed' },
    });
    if (
      invoice &&
      confirmation?.status === 'accepted' &&
      !confirmation.payload.invoiceAttached &&
      !pdfBlocker(invoice)
    ) {
      await enqueue(
        db,
        'invoice_issued',
        invoice.id,
        booking,
        { ...data, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
        recipient,
      );
    }
    // A consolidated confirmation carries a ready invoice; only delayed PDFs get a separate email.
  }
  if (booking.status === 'CANCELLED')
    await enqueue(
      db,
      'booking_cancelled',
      booking.id,
      booking,
      { ...data, refundAmount: refunds.reduce((sum, r) => sum + Number(r.amount), 0) },
      recipient,
    );
  for (const refund of refunds) {
    const events = await db.refundWebhookEvent.findMany({ where: { refundId: refund.id } });
    const success =
      refund.status === 'succeeded' &&
      events.some((e) => e.eventType === 'refund.processed' && e.processedAt);
    const failed =
      refund.status === 'failed' &&
      events.some((e) => e.eventType === 'refund.failed' && e.processedAt);
    if (success || failed)
      await enqueue(
        db,
        success ? 'refund_succeeded' : 'refund_failed',
        refund.id,
        booking,
        { ...data, refundAmount: Number(refund.amount) },
        recipient,
      );
  }
}

async function deliver(
  id,
  {
    db = prisma,
    send = emailService.send,
    mode = process.env.TRANSACTIONAL_EMAIL_MODE || 'disabled',
    allowlist = process.env.TRANSACTIONAL_EMAIL_ALLOWLIST || '',
  } = {},
) {
  const row = await db.emailDelivery.findUnique({ where: { id } });
  if (
    !row ||
    !['pending', 'failed', 'blocked'].includes(row.status) ||
    row.nextAttemptAt > new Date() ||
    row.attempts >= 5 ||
    mode === 'disabled'
  )
    return;
  if (
    mode === 'smtp' &&
    (process.env.NODE_ENV !== 'production' || !!allowlist) &&
    !allowlist
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .includes(row.recipient.toLowerCase())
  ) {
    await db.emailDelivery.update({
      where: { id },
      data: {
        status: 'blocked',
        lastErrorCode: 'TEST_RECIPIENT_NOT_ALLOWLISTED',
        nextAttemptAt: new Date(Date.now() + 900000),
      },
    });
    return;
  }
  let attachments = [];
  if (row.payload.invoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: row.payload.invoiceId } });
    const blocker = invoice ? pdfBlocker(invoice) : 'INVOICE_NOT_FOUND';
    if (blocker) {
      // Confirmation must not be lost because the PDF is awaiting configuration.
      if (row.eventType === 'invoice_issued') {
        await db.emailDelivery.update({
          where: { id },
          data: {
            status: 'blocked',
            lastErrorCode: blocker,
            nextAttemptAt: new Date(Date.now() + 900000),
          },
        });
        return;
      }
    } else
      attachments = [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: await renderPdf(invoice),
          contentType: 'application/pdf',
        },
      ];
  }
  const claim = await db.emailDelivery.updateMany({
    where: { id, status: row.status, attempts: row.attempts },
    data: { status: 'sending', claimedAt: new Date(), attempts: row.attempts + 1 },
  });
  if (claim.count !== 1) return;
  const message = {
    ...template(row.eventType, row.payload),
    to: row.recipient,
    attachments,
    messageId: `<${row.dedupeKey}@rentcar.local>`,
  };
  try {
    const info = mode === 'preview' ? { accepted: [], messageId: null } : await send(message);
    if (
      mode !== 'preview' &&
      !info.accepted?.some((a) => String(a).toLowerCase() === row.recipient.toLowerCase())
    ) {
      const err = new Error('Recipient not accepted');
      err.definitive = true;
      throw err;
    }
    await db.emailDelivery.update({
      where: { id },
      data: {
        status: mode === 'preview' ? 'preview' : 'accepted',
        payload: { ...row.payload, invoiceAttached: attachments.length > 0 },
        acceptedAt: mode === 'preview' ? null : new Date(),
        providerMessageId: info.messageId || null,
        lastErrorCode: null,
      },
    });
  } catch (err) {
    const safeToRetry = err.definitive || Number(err.responseCode) >= 400;
    await db.emailDelivery.update({
      where: { id },
      data: {
        status: safeToRetry ? (row.attempts + 1 >= 5 ? 'exhausted' : 'failed') : 'unknown',
        lastErrorCode: safeToRetry ? 'EMAIL_REJECTED' : 'EMAIL_OUTCOME_UNKNOWN',
        nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts)),
      },
    });
  }
}

async function tick({
  db = prisma,
  since = process.env.TRANSACTIONAL_EMAIL_SINCE,
  ...options
} = {}) {
  if (!since || !Number.isFinite(Date.parse(since)))
    throw new Error('TRANSACTIONAL_EMAIL_SINCE_REQUIRED');
  let offset = 0;
  for (;;) {
    const bookings = await db.booking.findMany({
      where: { createdAt: { gte: new Date(since) } },
      orderBy: { id: 'asc' },
      skip: offset,
      take: 100,
    });
    for (const b of bookings) await projectBooking(b, db);
    if (bookings.length < 100) break;
    offset += bookings.length;
  }
  // SMTP acceptance followed by process death is ambiguous. Never auto-resend.
  await db.emailDelivery.updateMany({
    where: { status: 'sending', claimedAt: { lte: new Date(Date.now() - 300000) } },
    data: { status: 'unknown', lastErrorCode: 'WORKER_INTERRUPTED' },
  });
  const rows = await db.emailDelivery.findMany({
    where: { status: { in: ['pending', 'failed', 'blocked'] }, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  for (const r of rows) await deliver(r.id, { ...options, db });
}
module.exports = { template, enqueue, projectBooking, deliver, tick };
