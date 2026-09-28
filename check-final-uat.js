'use strict';

const fs = require('fs');
const { prisma } = require('./src/config/database');

(async () => {
  try {
    const sinceText = fs
      .readFileSync('.final-uat-worker-since.txt', 'utf8')
      .trim();

    const since = new Date(sinceText);

    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log('\n====================================================');
    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log('FINAL UAT WORKER BOUNDARY');
    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log('====================================================');
    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log(since.toISOString());

    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: since },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log('\n====================================================');
    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log('BOOKINGS CREATED AFTER BOUNDARY:', bookings.length);
    // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
    console.log('====================================================');

    for (const booking of bookings) {
      const payments = await prisma.payment.findMany({
        where: { bookingId: booking.id },
        orderBy: { createdAt: 'asc' },
      });

      const invoice = await prisma.invoice.findUnique({
        where: { bookingId: booking.id },
      });

      const emails = await prisma.emailDelivery.findMany({
        where: { bookingId: booking.id },
        orderBy: { createdAt: 'asc' },
      });

      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log('\n----------------------------------------------------');
      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log('BOOKING');
      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log('----------------------------------------------------');

      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        totalAmount: String(booking.totalAmount),
        currency: booking.currencyCode,
        createdAt: booking.createdAt,
      });

      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log('\nPAYMENTS');

      if (!payments.length) {
        // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
        console.log('  NONE');
      }

      for (const p of payments) {
        // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
        console.log({
          id: p.id,
          status: p.status,
          operationalStatus: p.operationalStatus,
          providerOrderId: p.providerOrderId,
          providerPaymentId: p.providerPaymentId,
          amount: String(p.amount),
          paidAt: p.paidAt,
        });
      }

      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log('\nDOCUMENT');

      if (!invoice) {
        // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
        console.log('  NONE');
      } else {
        // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
        console.log({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt,
        });
      }

      // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
      console.log('\nEMAIL DELIVERIES');

      if (!emails.length) {
        // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
        console.log('  NONE');
      }

      for (const e of emails) {
        // eslint-disable-next-line no-console -- Intentional CLI report on stdout; preserve operator output.
        console.log({
          id: e.id,
          eventType: e.eventType,
          recipient: e.recipient,
          status: e.status,
          attempts: e.attempts,
          createdAt: e.createdAt,
          claimedAt: e.claimedAt,
          acceptedAt: e.acceptedAt,
          lastErrorCode: e.lastErrorCode,
        });
      }
    }

  } catch (err) {
    console.error('\nCHECK FAILED');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
