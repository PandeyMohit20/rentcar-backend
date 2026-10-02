'use strict';

const { UtilizationRepository } = require('./repository');

const roundPercent = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const dateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const daysBetween = (start, end) => {
  const milliseconds = end.getTime() - start.getTime();

  return Math.max(
    0,
    Math.ceil(milliseconds / (24 * 60 * 60 * 1000)),
  );
};

function getRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endExclusive = addDays(
    new Date(`${endDate}T00:00:00.000Z`),
    1,
  );

  return {
    start,
    endExclusive,
    days: daysBetween(start, endExclusive),
  };
}

function overlapDays(booking, range) {
  const bookingStart = new Date(booking.startAt);
  const bookingEnd = new Date(booking.endAt);

  const start =
    bookingStart > range.start
      ? bookingStart
      : range.start;

  const end =
    bookingEnd < range.endExclusive
      ? bookingEnd
      : range.endExclusive;

  return daysBetween(start, end);
}

function createVehicleRow(car, fleetDays) {
  return {
    vehicleId: car.id,
    registrationNumber: car.registrationNumber,
    vehicle: `${car.brand} ${car.model}`,
    variant: car.variant || null,

    branchId: car.branch?.id || car.branchId,
    branchName: car.branch?.name || '—',

    vendorId: car.vendor?.id || car.vendorId,
    vendorName: car.vendor?.companyName || '—',

    fleetDays,
    bookedDays: 0,
    availableDays: fleetDays,
    utilizationRate: 0,
  };
}

const UtilizationService = {
  async getDashboard(filters = {}) {
    const range = getRange(
      filters.startDate,
      filters.endDate,
    );

    const [fleet, bookings] = await Promise.all([
      UtilizationRepository.getFleet(filters),
      UtilizationRepository.getBookings(filters),
    ]);

    const fleetDays = fleet.length * range.days;

    const vehicleMap = new Map();

    for (const car of fleet) {
      vehicleMap.set(
        car.id,
        createVehicleRow(car, range.days),
      );
    }

    /*
     * Track booked calendar dates per vehicle.
     *
     * This prevents overlapping bookings from double-counting
     * utilization days.
     */
    const bookedDatesByVehicle = new Map();

    for (const booking of bookings) {
      if (!vehicleMap.has(booking.carId)) {
        continue;
      }

      const start = new Date(booking.startAt);
      const end = new Date(booking.endAt);

      const effectiveStart =
        start > range.start ? start : range.start;

      const effectiveEnd =
        end < range.endExclusive
          ? end
          : range.endExclusive;

      if (effectiveStart >= effectiveEnd) {
        continue;
      }

      if (!bookedDatesByVehicle.has(booking.carId)) {
        bookedDatesByVehicle.set(
          booking.carId,
          new Set(),
        );
      }

      const dateSet =
        bookedDatesByVehicle.get(booking.carId);

      let cursor = new Date(
        Date.UTC(
          effectiveStart.getUTCFullYear(),
          effectiveStart.getUTCMonth(),
          effectiveStart.getUTCDate(),
        ),
      );

      const finalDate = new Date(
        Date.UTC(
          effectiveEnd.getUTCFullYear(),
          effectiveEnd.getUTCMonth(),
          effectiveEnd.getUTCDate(),
        ),
      );

      while (cursor < finalDate) {
        dateSet.add(dateKey(cursor));
        cursor = addDays(cursor, 1);
      }
    }

    for (const [vehicleId, dateSet] of bookedDatesByVehicle) {
      const row = vehicleMap.get(vehicleId);

      if (!row) {
        continue;
      }

      row.bookedDays = dateSet.size;
      row.availableDays = Math.max(
        0,
        row.fleetDays - row.bookedDays,
      );

      row.utilizationRate =
        row.fleetDays > 0
          ? roundPercent(
              (row.bookedDays / row.fleetDays) * 100,
            )
          : 0;
    }

    const vehicles = [...vehicleMap.values()];

    const totalBookedDays = vehicles.reduce(
      (sum, row) => sum + row.bookedDays,
      0,
    );

    const totalAvailableDays = Math.max(
      0,
      fleetDays - totalBookedDays,
    );

    const utilizationRate =
      fleetDays > 0
        ? roundPercent(
            (totalBookedDays / fleetDays) * 100,
          )
        : 0;

    /*
     * Branch aggregation
     */
    const branchMap = new Map();

    for (const row of vehicles) {
      const key = row.branchId;

      if (!branchMap.has(key)) {
        branchMap.set(key, {
          branchId: row.branchId,
          branchName: row.branchName,
          fleet: 0,
          fleetDays: 0,
          bookedDays: 0,
          availableDays: 0,
          utilizationRate: 0,
        });
      }

      const branch = branchMap.get(key);

      branch.fleet += 1;
      branch.fleetDays += row.fleetDays;
      branch.bookedDays += row.bookedDays;
      branch.availableDays += row.availableDays;
    }

    const branches = [...branchMap.values()].map((row) => ({
      ...row,
      utilizationRate:
        row.fleetDays > 0
          ? roundPercent(
              (row.bookedDays / row.fleetDays) * 100,
            )
          : 0,
    }));

    /*
     * Vendor aggregation
     */
    const vendorMap = new Map();

    for (const row of vehicles) {
      const key = row.vendorId;

      if (!vendorMap.has(key)) {
        vendorMap.set(key, {
          vendorId: row.vendorId,
          vendorName: row.vendorName,
          fleet: 0,
          fleetDays: 0,
          bookedDays: 0,
          availableDays: 0,
          utilizationRate: 0,
        });
      }

      const vendor = vendorMap.get(key);

      vendor.fleet += 1;
      vendor.fleetDays += row.fleetDays;
      vendor.bookedDays += row.bookedDays;
      vendor.availableDays += row.availableDays;
    }

    const vendors = [...vendorMap.values()].map((row) => ({
      ...row,
      utilizationRate:
        row.fleetDays > 0
          ? roundPercent(
              (row.bookedDays / row.fleetDays) * 100,
            )
          : 0,
    }));

    /*
     * Daily trend
     */
    const trendMap = new Map();

    for (
      let cursor = new Date(range.start);
      cursor < range.endExclusive;
      cursor = addDays(cursor, 1)
    ) {
      trendMap.set(dateKey(cursor), {
        date: dateKey(cursor),
        fleet: fleet.length,
        bookedVehicles: 0,
        utilizationRate: 0,
      });
    }

    for (const [vehicleId, dates] of bookedDatesByVehicle) {
      for (const date of dates) {
        const trend = trendMap.get(date);

        if (trend) {
          trend.bookedVehicles += 1;
        }
      }
    }

    const trend = [...trendMap.values()].map((row) => ({
      ...row,
      utilizationRate:
        row.fleet > 0
          ? roundPercent(
              (row.bookedVehicles / row.fleet) * 100,
            )
          : 0,
    }));

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        days: range.days,
      },

      summary: {
        totalVehicles: fleet.length,
        fleetDays,
        bookedDays: totalBookedDays,
        availableDays: totalAvailableDays,
        utilizationRate,
      },

      trend,
      vehicles,
      branches,
      vendors,
    };
  },
};

module.exports = {
  UtilizationService,
};