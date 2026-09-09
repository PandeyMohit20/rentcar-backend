'use strict';
const assert = require('assert/strict');
const { prisma } = require('../src/config/database');
const { nextInvoiceNumber } = require('../src/modules/invoices/number');
const fiscalYear = 2087;
(async () => {
  assert.equal(require('../src/config/env').env.TEST_DATABASE_MOCK, false);
  assert.equal(await prisma.invoiceSequence.findUnique({ where: { fiscalYear } }), null, 'Fixture year is already in use; no changes made');
  try {
    const settled = await Promise.allSettled(Array.from({ length: 20 }, () => prisma.$transaction(tx => nextInvoiceNumber(tx, new Date('2087-06-01T00:00:00Z')), { maxWait: 20000, timeout: 20000 })));
    assert.equal(settled.filter(r => r.status === 'rejected').length, 0);
    const numbers = settled.map(r => r.value);
    assert.equal(new Set(numbers).size, 20);
    assert.deepEqual(numbers.map(n => Number(n.slice(6))).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
    process.stdout.write('PASS: real MySQL, 20 concurrent invoice sequence allocations, unique consecutive numbers\n');
  } finally {
    await prisma.invoiceSequence.deleteMany({ where: { fiscalYear } });
  }
})().catch(() => { process.stderr.write('INVOICE_SEQUENCE_CONCURRENCY_FAILED\n'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
