'use strict';

const { prisma } = require('../../config/database');
const { hasPermission } = require('../../services/authorization.service');
const AppError = require('../../errors/AppError');

async function assertSettlementReadAccess(user, vendorId, db = prisma) {
  // Existing global permission boundary, including centralized SUPER_ADMIN wildcard.
  if (hasPermission(user, 'admin.all')) return;
  if (!hasPermission(user, 'vendors.view')) {
    throw new AppError('Insufficient permissions to perform this action.', 403, 'AUTH_FORBIDDEN');
  }
  const member = await db.vendorMember.findFirst({
    where: { vendorId, userId: user.sub }, select: { id: true },
  });
  if (!member) throw new AppError('Vendor not found.', 404, 'RESOURCE_NOT_FOUND');
}

module.exports = { assertSettlementReadAccess };
