'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const { prisma } = require('../src/config/database');
const { enqueue, deliver } = require('../src/services/email/transactional');
const bookingId = crypto.randomUUID();
const recipient = 'email-concurrency@example.test';
(async () => {
  assert.equal(require('../src/config/env').env.TEST_DATABASE_MOCK, false);
  let sends = 0;
  const data = {
    name: 'Fixture',
    bookingNumber: 'EMAIL-CONCURRENCY',
    vehicle: 'Fixture',
    pickup: '2030-01-01T00:00:00Z',
    return: '2030-01-02T00:00:00Z',
    total: 100,
    currency: 'INR',
  };
  try {
    for (let i = 0; i < 20; i += 1) {
      const entity = `${bookingId}-${i}`;
      await Promise.all([
        enqueue(prisma, 'booking_created', entity, { id: bookingId }, data, recipient),
        enqueue(prisma, 'booking_created', entity, { id: bookingId }, data, recipient),
      ]);
      const row = await prisma.emailDelivery.findFirst({ where: { bookingId, status: 'pending' } });
      assert.ok(row);
      const options = {
        db: prisma,
        mode: 'smtp',
        allowlist: recipient,
        send: async () => {
          sends += 1;
          return { accepted: [recipient], messageId: 'fixture-only' };
        },
      };
      await Promise.all([deliver(row.id, options), deliver(row.id, options)]);
      assert.equal(
        (await prisma.emailDelivery.findUnique({ where: { id: row.id } })).status,
        'accepted',
      );
    }
    assert.equal(await prisma.emailDelivery.count({ where: { bookingId } }), 20);
    assert.equal(sends, 20);
    process.stdout.write(
      'PASS: real MySQL, 20 concurrent enqueue/claim iterations, 20 fake sends, 0 duplicates, 0 real emails\n',
    );
  } finally {
    await prisma.emailDelivery.deleteMany({ where: { bookingId } });
  }
})()
  .catch(() => {
    process.stderr.write('EMAIL_CONCURRENCY_FAILED\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
