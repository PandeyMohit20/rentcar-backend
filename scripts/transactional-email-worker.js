'use strict';
require('../src/config/env');
const { prisma } = require('../src/config/database');
const { tick } = require('../src/services/email/transactional');
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
(async () => {
  if (!['preview', 'smtp'].includes(process.env.TRANSACTIONAL_EMAIL_MODE))
    throw new Error('TRANSACTIONAL_EMAIL_MODE_REQUIRED');
  do {
    await tick();
    if (process.argv.includes('--once')) break;
    await new Promise((resolve) => setTimeout(resolve, 15000));
  } while (!stopping);
})()
  .catch(() => {
    // Never log transport errors, credentials, message bodies or recipient data.
    process.stderr.write('TRANSACTIONAL_EMAIL_WORKER_FAILED\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
