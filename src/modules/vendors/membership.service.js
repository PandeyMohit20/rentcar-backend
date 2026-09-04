'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');

const missing = (message) => new AppError(message, httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);

/**
 * Internal-only foundation for a future controlled membership workflow.
 * The vendor-row lock serializes every owner reassignment for that vendor.
 */
async function assignVendorOwner(vendorId, userId, { afterOwnersCleared } = {}) {
  return prisma.$transaction(async (tx) => {
    if (tx.$queryRaw) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM vendors WHERE id = ${vendorId} FOR UPDATE`);
    }
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.isDeleted) throw missing('Vendor not found.');

    const target = await tx.vendorMember.findFirst({ where: { vendorId, userId } });
    if (!target) throw missing('Vendor membership not found.');

    await tx.vendorMember.updateMany({ where: { vendorId, isOwner: true }, data: { isOwner: false } });
    if (afterOwnersCleared) await afterOwnersCleared();
    const owner = await tx.vendorMember.update({ where: { id: target.id }, data: { isOwner: true } });
    return owner;
  });
}

module.exports = { assignVendorOwner };
