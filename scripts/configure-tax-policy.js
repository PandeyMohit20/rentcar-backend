'use strict';
// Explicit operator configuration; never supplies an assumed GST rate or identity.
const fs = require('fs');
const { prisma } = require('../src/config/database');
const { vehicleProfileSchema } = require('../src/modules/pricing/tax');
(async () => {
  const [vendorId, file] = process.argv.slice(2);
  if (!vendorId || !file)
    throw new Error('Usage: node scripts/configure-tax-policy.js VENDOR_ID APPROVED_POLICY_JSON');
  const result = vehicleProfileSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!result.success) throw new Error('TAX_POLICY_CONFIGURATION_INVALID');
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, status: true, isDeleted: true },
  });
  if (!vendor || vendor.isDeleted || vendor.status !== 'active')
    throw new Error('ACTIVE_VENDOR_REQUIRED');
  await prisma.vendor.update({ where: { id: vendorId }, data: { taxProfile: result.data } });
  process.stdout.write('APPROVED_TAX_POLICY_SAVED\n');
})()
  .catch(() => {
    process.stderr.write('TAX_POLICY_CONFIGURATION_FAILED\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
