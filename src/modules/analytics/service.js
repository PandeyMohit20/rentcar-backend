'use strict';

const { AnalyticsRepository } = require('./repository');

function numberValue(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function formatDate(date) {
  if (!date) {
    return null;
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function formatMonth(date) {
  if (!date) {
    return null;
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 7);
}

function addToMap(map, key, value) {
  map.set(key, (map.get(key) || 0) + numberValue(value));
}

function mapToArray(map, keyName, valueName) {
  return Array.from(map.entries()).map(([key, value]) => ({
    [keyName]: key,
    [valueName]: round(value),
  }));
}

const AnalyticsService = {
  async getOverview(filters = {}) {
    const [
      bookings,
      payments,
      refunds,
      customers,
      fleet,
    ] = await Promise.all([
      AnalyticsRepository.getBookings(filters),
      AnalyticsRepository.getSucceededPayments(filters),
      AnalyticsRepository.getSucceededRefunds(filters),
      AnalyticsRepository.getCustomers(filters),
      AnalyticsRepository.getFleet(filters),
    ]);

    // ============================================================
    // PAYMENT / REFUND MAPS
    // ============================================================

    const paymentByBooking = new Map();

    for (const payment of payments) {
      addToMap(
        paymentByBooking,
        payment.bookingId,
        payment.amount,
      );
    }

    const refundByBooking = new Map();

    for (const refund of refunds) {
      addToMap(
        refundByBooking,
        refund.bookingId,
        refund.amount,
      );
    }

    // ============================================================
    // BOOKING COUNTS
    // ============================================================

    const bookingStatusMap = new Map();

    for (const booking of bookings) {
      const status = booking.status || 'UNKNOWN';

      bookingStatusMap.set(
        status,
        (bookingStatusMap.get(status) || 0) + 1,
      );
    }

    const paymentStatusMap = new Map();

    for (const booking of bookings) {
      const status = booking.paymentStatus || 'UNKNOWN';

      paymentStatusMap.set(
        status,
        (paymentStatusMap.get(status) || 0) + 1,
      );
    }

    const totalBookings = bookings.length;

    const completedBookings = bookings.filter(
      (booking) => booking.status === 'COMPLETED',
    ).length;

    const activeBookings = bookings.filter(
      (booking) => booking.status === 'ACTIVE',
    ).length;

    const confirmedBookings = bookings.filter(
      (booking) => booking.status === 'CONFIRMED',
    ).length;

    const cancelledBookings = bookings.filter(
      (booking) => booking.status === 'CANCELLED',
    ).length;

    const pendingBookings = bookings.filter(
      (booking) =>
        booking.status === 'PENDING' ||
        booking.status === 'PAYMENT_PENDING',
    ).length;

    // ============================================================
    // COLLECTION
    // ============================================================

    const grossCollected = payments.reduce(
      (total, payment) => total + numberValue(payment.amount),
      0,
    );

    const totalRefunds = refunds.reduce(
      (total, refund) => total + numberValue(refund.amount),
      0,
    );

    const netCollected = grossCollected - totalRefunds;

    // ============================================================
    // BOOKING VALUE
    // ============================================================

    const paidBookings = bookings.filter(
      (booking) => paymentByBooking.has(booking.id),
    );

    const grossBookingValue = bookings.reduce(
      (total, booking) => {
        return total + numberValue(booking.totalAmount);
      },
      0,
    );

    const paidBookingValue = paidBookings.reduce(
      (total, booking) => {
        return total + numberValue(booking.totalAmount);
      },
      0,
    );

    const averageBookingValue =
      paidBookings.length > 0
        ? paidBookingValue / paidBookings.length
        : 0;

    // Existing analytics "revenue" concept:
    // subtotal + tax - discount, excluding security deposit.
    const recognizedRevenue = paidBookings.reduce(
      (total, booking) => {
        return (
          total +
          numberValue(booking.subtotal) +
          numberValue(booking.tax) -
          numberValue(booking.discount)
        );
      },
      0,
    );

    // ============================================================
    // CANCELLATION
    // ============================================================

    const cancellationRate =
      totalBookings > 0
        ? (cancelledBookings / totalBookings) * 100
        : 0;

    // ============================================================
    // FLEET
    // ============================================================

    const fleetStatusMap = new Map();

    for (const car of fleet) {
      const status = car.status || 'unknown';

      fleetStatusMap.set(
        status,
        (fleetStatusMap.get(status) || 0) + 1,
      );
    }

    const totalFleet = fleet.length;

    const availableCars = fleet.filter(
      (car) => car.status === 'available',
    ).length;

    const bookedCars = fleet.filter(
      (car) => car.status === 'booked',
    ).length;

    const busyCars = fleet.filter(
      (car) => car.status === 'busy',
    ).length;

    const maintenanceCars = fleet.filter(
      (car) => car.status === 'maintenance',
    ).length;

    const inactiveCars = fleet.filter(
      (car) => car.status === 'inactive',
    ).length;

    const retiredCars = fleet.filter(
      (car) => car.status === 'retired',
    ).length;

    const utilizationRate =
      totalFleet > 0
        ? ((bookedCars + busyCars) / totalFleet) * 100
        : 0;

    // ============================================================
    // BOOKING TREND
    // ============================================================

    const bookingTrendMap = new Map();

    for (const booking of bookings) {
      const date = formatDate(booking.createdAt);

      if (!date) {
        continue;
      }

      if (!bookingTrendMap.has(date)) {
        bookingTrendMap.set(date, {
          bookings: 0,
          completed: 0,
          cancelled: 0,
          active: 0,
          revenue: 0,
        });
      }

      const row = bookingTrendMap.get(date);

      row.bookings += 1;

      if (booking.status === 'COMPLETED') {
        row.completed += 1;
      }

      if (booking.status === 'CANCELLED') {
        row.cancelled += 1;
      }

      if (booking.status === 'ACTIVE') {
        row.active += 1;
      }

      if (paymentByBooking.has(booking.id)) {
        row.revenue +=
          numberValue(booking.subtotal) +
          numberValue(booking.tax) -
          numberValue(booking.discount);
      }
    }

    const bookingTrend = Array.from(
      bookingTrendMap.entries(),
    ).map(([date, row]) => ({
      date,
      bookings: row.bookings,
      completed: row.completed,
      cancelled: row.cancelled,
      active: row.active,
      revenue: round(row.revenue),
    }));

    // ============================================================
    // COLLECTION TREND
    // ============================================================

    const collectionTrendMap = new Map();

    for (const payment of payments) {
      const date = formatDate(
        payment.paidAt || payment.createdAt,
      );

      if (!date) {
        continue;
      }

      if (!collectionTrendMap.has(date)) {
        collectionTrendMap.set(date, {
          collection: 0,
          refunds: 0,
          net: 0,
        });
      }

      collectionTrendMap.get(date).collection +=
        numberValue(payment.amount);
    }

    for (const refund of refunds) {
      const date = formatDate(
        refund.processedAt || refund.createdAt,
      );

      if (!date) {
        continue;
      }

      if (!collectionTrendMap.has(date)) {
        collectionTrendMap.set(date, {
          collection: 0,
          refunds: 0,
          net: 0,
        });
      }

      collectionTrendMap.get(date).refunds +=
        numberValue(refund.amount);
    }

    for (const row of collectionTrendMap.values()) {
      row.net = row.collection - row.refunds;
    }

    const collectionTrend = Array.from(
      collectionTrendMap.entries(),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date,
        collection: round(row.collection),
        refunds: round(row.refunds),
        net: round(row.net),
      }));

    // ============================================================
    // MONTHLY TREND
    // ============================================================

    const monthlyMap = new Map();

    for (const payment of payments) {
      const month = formatMonth(
        payment.paidAt || payment.createdAt,
      );

      if (!month) {
        continue;
      }

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          collection: 0,
          refunds: 0,
        });
      }

      monthlyMap.get(month).collection +=
        numberValue(payment.amount);
    }

    for (const refund of refunds) {
      const month = formatMonth(
        refund.processedAt || refund.createdAt,
      );

      if (!month) {
        continue;
      }

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          collection: 0,
          refunds: 0,
        });
      }

      monthlyMap.get(month).refunds +=
        numberValue(refund.amount);
    }

    const monthlyTrend = Array.from(
      monthlyMap.entries(),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, row]) => ({
        month,
        collection: round(row.collection),
        refunds: round(row.refunds),
        net: round(row.collection - row.refunds),
      }));

    // ============================================================
    // TOP CARS
    // ============================================================

    const carPerformanceMap = new Map();

    for (const booking of bookings) {
      if (!booking.car) {
        continue;
      }

      const carId = booking.car.id;

      if (!carPerformanceMap.has(carId)) {
        carPerformanceMap.set(carId, {
          carId,
          brand: booking.car.brand,
          model: booking.car.model,
          registrationNumber:
            booking.car.registrationNumber,
          bookings: 0,
          revenue: 0,
          collection: 0,
          refunds: 0,
        });
      }

      const row = carPerformanceMap.get(carId);

      row.bookings += 1;

      if (paymentByBooking.has(booking.id)) {
        row.revenue +=
          numberValue(booking.subtotal) +
          numberValue(booking.tax) -
          numberValue(booking.discount);
      }

      row.collection +=
        paymentByBooking.get(booking.id) || 0;

      row.refunds +=
        refundByBooking.get(booking.id) || 0;
    }

    const topCars = Array.from(
      carPerformanceMap.values(),
    )
      .map((row) => ({
        ...row,
        revenue: round(row.revenue),
        collection: round(row.collection),
        refunds: round(row.refunds),
        net: round(row.collection - row.refunds),
      }))
      .sort((a, b) => b.collection - a.collection)
      .slice(0, 10);

    // ============================================================
    // BRANCH PERFORMANCE
    // ============================================================

    const branchMap = new Map();

    for (const booking of bookings) {
      const branch = booking.car?.branch;

      if (!branch) {
        continue;
      }

      if (!branchMap.has(branch.id)) {
        branchMap.set(branch.id, {
          branchId: branch.id,
          branchName: branch.name,
          city: branch.city,
          bookings: 0,
          collection: 0,
          refunds: 0,
          revenue: 0,
        });
      }

      const row = branchMap.get(branch.id);

      row.bookings += 1;

      row.collection +=
        paymentByBooking.get(booking.id) || 0;

      row.refunds +=
        refundByBooking.get(booking.id) || 0;

      if (paymentByBooking.has(booking.id)) {
        row.revenue +=
          numberValue(booking.subtotal) +
          numberValue(booking.tax) -
          numberValue(booking.discount);
      }
    }

    const branchPerformance = Array.from(
      branchMap.values(),
    )
      .map((row) => ({
        ...row,
        revenue: round(row.revenue),
        collection: round(row.collection),
        refunds: round(row.refunds),
        net: round(row.collection - row.refunds),
      }))
      .sort((a, b) => b.collection - a.collection);

    // ============================================================
    // CITY PERFORMANCE
    // ============================================================

    const cityMap = new Map();

    for (const booking of bookings) {
      const branch = booking.car?.branch;

      if (!branch?.city) {
        continue;
      }

      const city = branch.city;

      if (!cityMap.has(city)) {
        cityMap.set(city, {
          city,
          bookings: 0,
          collection: 0,
          refunds: 0,
          revenue: 0,
        });
      }

      const row = cityMap.get(city);

      row.bookings += 1;

      row.collection +=
        paymentByBooking.get(booking.id) || 0;

      row.refunds +=
        refundByBooking.get(booking.id) || 0;

      if (paymentByBooking.has(booking.id)) {
        row.revenue +=
          numberValue(booking.subtotal) +
          numberValue(booking.tax) -
          numberValue(booking.discount);
      }
    }

    const cityPerformance = Array.from(
      cityMap.values(),
    )
      .map((row) => ({
        ...row,
        revenue: round(row.revenue),
        collection: round(row.collection),
        refunds: round(row.refunds),
        net: round(row.collection - row.refunds),
      }))
      .sort((a, b) => b.collection - a.collection);

    // ============================================================
    // PAYMENT METHODS
    // ============================================================

    const paymentMethodMap = new Map();

    for (const payment of payments) {
      const method = payment.paymentMethod || 'unknown';

      if (!paymentMethodMap.has(method)) {
        paymentMethodMap.set(method, {
          method,
          count: 0,
          amount: 0,
        });
      }

      const row = paymentMethodMap.get(method);

      row.count += 1;
      row.amount += numberValue(payment.amount);
    }

    const paymentMethods = Array.from(
      paymentMethodMap.values(),
    ).map((row) => ({
      ...row,
      amount: round(row.amount),
    }));

    // ============================================================
    // CUSTOMER STATUS
    // ============================================================

    const customerStatusMap = new Map();

    for (const customer of customers) {
      const status = customer.status || 'unknown';

      customerStatusMap.set(
        status,
        (customerStatusMap.get(status) || 0) + 1,
      );
    }

    // ============================================================
    // FINAL RESPONSE
    // ============================================================

    const currencyCode =
      bookings.find((booking) => booking.currencyCode)
        ?.currencyCode ||
      payments.find((payment) => payment.currencyCode)
        ?.currencyCode ||
      refunds.find((refund) => refund.currencyCode)
        ?.currencyCode ||
      'INR';

    return {
      filters: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        vendorId: filters.vendorId || null,
        branchId: filters.branchId || null,
        carId: filters.carId || null,
        city: filters.city || null,
        bookingStatus: filters.bookingStatus || null,
        paymentStatus: filters.paymentStatus || null,
      },

      currencyCode,

      kpis: {
        totalBookings,

        completedBookings,
        activeBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,

        totalCustomers: customers.length,

        totalFleet,
        availableCars,
        bookedCars,
        busyCars,
        maintenanceCars,
        inactiveCars,
        retiredCars,

        utilizationRate: round(utilizationRate),

        grossBookingValue: round(grossBookingValue),
        paidBookingValue: round(paidBookingValue),

        grossCollected: round(grossCollected),
        totalRefunds: round(totalRefunds),
        netCollected: round(netCollected),

        revenue: round(recognizedRevenue),

        averageBookingValue: round(
          averageBookingValue,
        ),

        cancellationRate: round(
          cancellationRate,
        ),
      },

      breakdowns: {
        bookingsByStatus: Array.from(
          bookingStatusMap.entries(),
        ).map(([status, count]) => ({
          status,
          count,
        })),

        bookingsByPaymentStatus: Array.from(
          paymentStatusMap.entries(),
        ).map(([status, count]) => ({
          status,
          count,
        })),

        customersByStatus: Array.from(
          customerStatusMap.entries(),
        ).map(([status, count]) => ({
          status,
          count,
        })),

        fleetByStatus: Array.from(
          fleetStatusMap.entries(),
        ).map(([status, count]) => ({
          status,
          count,
        })),

        paymentMethods,
      },

      trends: {
        bookingTrend,
        collectionTrend,
        monthlyTrend,
      },

      topCars,

      branches: branchPerformance,

      cities: cityPerformance,

      generatedAt: new Date().toISOString(),
    };
  },
};

module.exports = {
  AnalyticsService,
};