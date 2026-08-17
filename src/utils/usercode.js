'use strict';

const { prisma } = require('../config/database');

function getFinancialYear() {
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // April-March financial year
  if (month >= 4) {
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  }

  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

async function generateUserCode(role, db = prisma) {
  const prefix =
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN'
      ? 'ADM'
      : 'USR';

  const financialYear = getFinancialYear();

  const pattern = `${prefix}-${financialYear}-`;

  const lastUser = await db.user.findFirst({
    where: {
      userCode: {
        startsWith: pattern,
      },
    },
    orderBy: {
      userCode: 'desc',
    },
    select: {
      userCode: true,
    },
  });

  let nextNumber = 1;

  if (lastUser?.userCode) {
    const parts = lastUser.userCode.split('-');
    const lastNumber = Number(parts[3]);

    if (Number.isInteger(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${pattern}${String(nextNumber).padStart(3, '0')}`;
}

module.exports = {
  generateUserCode,
  getFinancialYear,
};