'use strict';
const { Prisma } = require('@prisma/client');
async function nextInvoiceNumber(db, now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000);
  const fiscalYear = ist.getUTCFullYear() - (ist.getUTCMonth() < 3 ? 1 : 0);
  let sequence;
  if (db.$executeRaw) {
    // Native MySQL upsert avoids Prisma's concurrent first-row creation race.
    // The surrounding financial transaction retains this row lock until commit.
    await db.$executeRaw(Prisma.sql`INSERT INTO invoice_sequences (fiscal_year, next_number) VALUES (${fiscalYear}, 1) ON DUPLICATE KEY UPDATE next_number = next_number + 1`);
    const rows = await db.$queryRaw(Prisma.sql`SELECT next_number AS nextNumber FROM invoice_sequences WHERE fiscal_year = ${fiscalYear} FOR UPDATE`);
    sequence = rows[0];
  } else {
    sequence = await db.invoiceSequence.upsert({ where: { fiscalYear }, create: { fiscalYear, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
  }
  if (sequence.nextNumber > 999999999) throw new Error('INVOICE_SEQUENCE_EXHAUSTED');
  return `RC${String(fiscalYear).slice(-2)}${String(fiscalYear + 1).slice(-2)}${String(sequence.nextNumber).padStart(9, '0')}`;
}
module.exports = { nextInvoiceNumber };
