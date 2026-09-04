'use strict';

const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { assignVendorOwner } = require('../src/modules/vendors/membership.service');

describe('VendorMember owner invariant', () => {
  beforeEach(resetStore);
  it('serially assigns one owner and rolls back if assignment fails after clearing owners', async () => {
    const first = await seedUser({ email: `owner-a-${Math.random()}@test` }); const second = await seedUser({ email: `owner-b-${Math.random()}@test` });
    const vendor = await prisma.vendor.create({ data: { vendorCode: `V-${Math.random()}`, companyName: 'Owner test' } });
    await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: first.id, isOwner: true } }); await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: second.id, isOwner: false } });
    await assignVendorOwner(vendor.id, second.id); expect(await prisma.vendorMember.count({ where: { vendorId: vendor.id, isOwner: true } })).toBe(1);
    await expect(assignVendorOwner(vendor.id, first.id, { afterOwnersCleared: async () => { throw new Error('ROLLBACK'); } })).rejects.toThrow('ROLLBACK');
    const owner = await prisma.vendorMember.findFirst({ where: { vendorId: vendor.id, isOwner: true } }); expect(owner.userId).toBe(second.id);
  });
});
