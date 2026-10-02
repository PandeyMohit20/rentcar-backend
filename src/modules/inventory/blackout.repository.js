'use strict';

const crypto = require('crypto');
const { prisma } = require('../../config/database');

const BLACKOUT_PREFIX = '[BLACKOUT:';

function buildBlackoutReason(token, type, reason) {
  return `${BLACKOUT_PREFIX}${token}:${type}] ${reason}`.slice(0, 255);
}

function parseBlackoutReason(value) {
  if (!value || !value.startsWith(BLACKOUT_PREFIX)) {
    return null;
  }

  const match = value.match(
    /^\[BLACKOUT:([0-9a-f-]{36}):([a-z_]+)\]\s*(.*)$/i,
  );

  if (!match) {
    return null;
  }

  return {
    token: match[1],
    type: match[2],
    reason: match[3] || '',
  };
}

function toDate(value) {
  return new Date(`${value}T00:00:00.000+05:30`);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function dateRange(startDate, endDate) {
  const result = [];
  const cursor = toDate(startDate);
  const end = toDate(endDate);

  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function groupRecords(records) {
  const groups = new Map();

  for (const record of records) {
    const parsed = parseBlackoutReason(record.reason);

    if (!parsed) {
      continue;
    }

    if (!groups.has(parsed.token)) {
      groups.set(parsed.token, {
        id: parsed.token,
        vehicleId: record.carId,
        startDate: formatDate(record.date),
        endDate: formatDate(record.date),
        type: parsed.type,
        reason: parsed.reason,
        recordIds: [],
      });
    }

    const group = groups.get(parsed.token);
    const currentDate = formatDate(record.date);

    if (currentDate < group.startDate) {
      group.startDate = currentDate;
    }

    if (currentDate > group.endDate) {
      group.endDate = currentDate;
    }

    group.recordIds.push(record.id);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
}

async function findBlackoutRecords(filters = {}) {
  const where = {};

  if (filters.vehicleId) {
    where.carId = filters.vehicleId;
  }

  if (filters.fromDate || filters.toDate) {
    where.date = {};

    if (filters.fromDate) {
      where.date.gte = toDate(filters.fromDate);
    }

    if (filters.toDate) {
      where.date.lte = new Date(
        `${filters.toDate}T23:59:59.999+05:30`,
      );
    }
  }

  const records = await prisma.carAvailability.findMany({
    where,
    orderBy: {
      date: 'asc',
    },
    select: {
      id: true,
      carId: true,
      date: true,
      status: true,
      reason: true,
    },
  });

  return records.filter((record) => parseBlackoutReason(record.reason));
}

async function findBlackoutById(id) {
  const records = await prisma.carAvailability.findMany({
    where: {
      reason: {
        startsWith: `${BLACKOUT_PREFIX}${id}:`,
      },
    },
    orderBy: {
      date: 'asc',
    },
    select: {
      id: true,
      carId: true,
      date: true,
      status: true,
      reason: true,
    },
  });

  if (!records.length) {
    return null;
  }

  return groupRecords(records)[0] || null;
}

async function createBlackout(data) {
  const token = crypto.randomUUID();
  const dates = dateRange(data.startDate, data.endDate);

  const status =
    data.type === 'maintenance'
      ? 'maintenance'
      : 'blocked';

  const reason = buildBlackoutReason(
    token,
    data.type,
    data.reason,
  );

  return prisma.$transaction(async (tx) => {
    const car = await tx.car.findUnique({
      where: {
        id: data.vehicleId,
      },
      select: {
        id: true,
        isDeleted: true,
      },
    });

    if (!car || car.isDeleted) {
      const error = new Error('Vehicle not found.');
      error.statusCode = 404;
      throw error;
    }

    await tx.carAvailability.deleteMany({
      where: {
        carId: data.vehicleId,
        date: {
          gte: dates[0],
          lte: dates[dates.length - 1],
        },
        status: 'available',
      },
    });

    await tx.carAvailability.createMany({
      data: dates.map((date) => ({
        carId: data.vehicleId,
        date,
        status,
        reason,
      })),
    });

    return {
      id: token,
      vehicleId: data.vehicleId,
      startDate: data.startDate,
      endDate: data.endDate,
      type: data.type,
      reason: data.reason,
    };
  });
}

async function updateBlackout(id, data) {
  return prisma.$transaction(async (tx) => {
    const records = await tx.carAvailability.findMany({
      where: {
        reason: {
          startsWith: `${BLACKOUT_PREFIX}${id}:`,
        },
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        id: true,
        carId: true,
        date: true,
      },
    });

    if (!records.length) {
      const error = new Error('Blackout not found.');
      error.statusCode = 404;
      throw error;
    }

    const vehicleId = data.vehicleId || records[0].carId;
    const startDate = data.startDate || formatDate(records[0].date);
    const endDate =
      data.endDate ||
      formatDate(records[records.length - 1].date);

    const old = await tx.carAvailability.findFirst({
      where: {
        reason: {
          startsWith: `${BLACKOUT_PREFIX}${id}:`,
        },
      },
      select: {
        reason: true,
      },
    });

    const parsed = parseBlackoutReason(old?.reason);

    const type = data.type || parsed?.type || 'other';
    const reason = data.reason || parsed?.reason || '';

    await tx.carAvailability.deleteMany({
      where: {
        reason: {
          startsWith: `${BLACKOUT_PREFIX}${id}:`,
        },
      },
    });

    const dates = dateRange(startDate, endDate);

    const status =
      type === 'maintenance'
        ? 'maintenance'
        : 'blocked';

    const encodedReason = buildBlackoutReason(
      id,
      type,
      reason,
    );

    await tx.carAvailability.createMany({
      data: dates.map((date) => ({
        carId: vehicleId,
        date,
        status,
        reason: encodedReason,
      })),
    });

    return {
      id,
      vehicleId,
      startDate,
      endDate,
      type,
      reason,
    };
  });
}

async function deleteBlackout(id) {
  const result = await prisma.carAvailability.deleteMany({
    where: {
      reason: {
        startsWith: `${BLACKOUT_PREFIX}${id}:`,
      },
    },
  });

  if (!result.count) {
    const error = new Error('Blackout not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    id,
    deletedRecords: result.count,
  };
}

module.exports = {
  BLACKOUT_PREFIX,
  buildBlackoutReason,
  parseBlackoutReason,
  groupRecords,
  findBlackoutRecords,
  findBlackoutById,
  createBlackout,
  updateBlackout,
  deleteBlackout,
};
