'use strict';

const { AnalyticsRepository } = require('./repository');

const MONEY_STATUSES = new Set(['CONFIRMED', 'ACTIVE', 'COMPLETED']);

const decimal = (value) => Number(value || 0);

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function dateKey(value) {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedMap(map, mapper) {
  return [...map.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(mapper);
}

function topValues(map, limit = 5) {
  return [...map.values()]
    .sort((a, b) => {
      if (b.bookings !== a.bookings) {
        return b.bookings - a.bookings;
      }

      return b.revenue - a.revenue;
    })
    .slice(0, limit);
}

const AnalyticsService = {
  async getOverview(filters = {}) {
    const [bookings, payments, fleet] = await Promise.all([
      AnalyticsRepository.getBookings(filters),
      AnalyticsRepository.getSucceededPayments(filters),
      AnalyticsRepository.getFleet(),
    ]);

    const paymentByBooking = new Map();

    for (const payment of payments) {
      const amount = decimal(payment.amount);
      paymentByBooking.set(
        payment.bookingId,
        (paymentByBooking.get(payment.bookingId) || 0) + amount,
      );
    }

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(
      (booking) => booking.status === 'COMPLETED',
    ).length;
    const activeBookings = bookings.filter(
      (booking) => booking.status === 'ACTIVE',
    ).length;
    const cancelledBookings = bookings.filter(
      (booking) => booking.status === 'CANCELLED',
    ).length;

    const paidBookingIds = new Set(
      payments.map((payment) => payment.bookingId),
    );

    const grossCollected = roundMoney(
      payments.reduce((sum, payment) => sum + decimal(payment.amount), 0),
    );

    const revenue = roundMoney(
      bookings
        .filter((booking) => paidBookingIds.has(booking.id))
        .reduce(
          (sum, booking) =>
            sum +
            decimal(booking.subtotal) +
            decimal(booking.tax) -
            decimal(booking.discount),
          0,
        ),
    );

    const paidBookingCount = paidBookingIds.size;

    const averageBookingValue =
      paidBookingCount > 0
        ? roundMoney(revenue / paidBookingCount)
        : 0;

    const cancellationRate =
      totalBookings > 0
        ? Math.round((cancelledBookings / totalBookings) * 10000) / 100
        : 0;

    const bookingStatus = new Map();
    const paymentStatus = new Map();
    const bookingTrend = new Map();
    const revenueTrend = new Map();
    const paymentMethods = new Map();

    const carPerformance = new Map();
    const branchPerformance = new Map();
    const cityPerformance = new Map();

    for (const booking of bookings) {
      increment(bookingStatus, booking.status);
      increment(paymentStatus, booking.paymentStatus);
      increment(bookingTrend, dateKey(booking.createdAt));

      const bookingRevenue = paidBookingIds.has(booking.id)
        ? roundMoney(
            decimal(booking.subtotal) +
              decimal(booking.tax) -
              decimal(booking.discount),
          )
        : 0;

      if (bookingRevenue > 0) {
        increment(
          revenueTrend,
          dateKey(booking.createdAt),
          bookingRevenue,
        );
      }

      const car = booking.car;

      if (car) {
        const carKey = car.id;

        if (!carPerformance.has(carKey)) {
          carPerformance.set(carKey, {
            carId: car.id,
            name: `${car.brand} ${car.model}`,
            registrationNumber: car.registrationNumber,
            bookings: 0,
            completedBookings: 0,
            revenue: 0,
          });
        }

        const carRow = carPerformance.get(carKey);
        carRow.bookings += 1;
        carRow.revenue = roundMoney(carRow.revenue + bookingRevenue);

        if (booking.status === 'COMPLETED') {
          carRow.completedBookings += 1;
        }

        const branch = car.branch;

        if (branch) {
          if (!branchPerformance.has(branch.id)) {
            branchPerformance.set(branch.id, {
              branchId: branch.id,
              name: branch.name,
              city: branch.city || null,
              bookings: 0,
              completedBookings: 0,
              revenue: 0,
            });
          }

          const branchRow = branchPerformance.get(branch.id);
          branchRow.bookings += 1;
          branchRow.revenue = roundMoney(
            branchRow.revenue + bookingRevenue,
          );

          if (booking.status === 'COMPLETED') {
            branchRow.completedBookings += 1;
          }

          const cityName = branch.city || 'Unknown';

          if (!cityPerformance.has(cityName)) {
            cityPerformance.set(cityName, {
              city: cityName,
              bookings: 0,
              completedBookings: 0,
              revenue: 0,
            });
          }

          const cityRow = cityPerformance.get(cityName);
          cityRow.bookings += 1;
          cityRow.revenue = roundMoney(
            cityRow.revenue + bookingRevenue,
          );

          if (booking.status === 'COMPLETED') {
            cityRow.completedBookings += 1;
          }
        }
      }
    }

    for (const payment of payments) {
      increment(paymentMethods, payment.paymentMethod);

      const key = dateKey(payment.paidAt || payment.createdAt);
      const current = revenueTrend.get(key) || 0;

      /*
       * Revenue trend is payment-date based. Remove any booking-date
       * contribution for this payment's booking before using the
       * authoritative payment date below.
       */
      revenueTrend.set(key, current);
    }

    const authoritativeRevenueTrend = new Map();

    for (const payment of payments) {
      increment(
        authoritativeRevenueTrend,
        dateKey(payment.paidAt || payment.createdAt),
        decimal(payment.amount),
      );
    }

    const fleetStatus = new Map();

    for (const car of fleet) {
      increment(fleetStatus, car.status);
    }
    const busyCars = fleetStatus.get('busy') || 0;
    const bookedCars = fleetStatus.get('booked') || 0;

    const utilizationRate =
      fleet.length > 0
        ? Math.round(
            ((busyCars + bookedCars) / fleet.length) * 10000,
          ) / 100
        : 0;

    return {
      filters: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        branchId: filters.branchId || null,
        city: filters.city || null,
      },

      currencyCode:
        payments[0]?.currencyCode ||
        bookings[0]?.currencyCode ||
        'INR',

      kpis: {
        revenue,
        grossCollected,
        totalBookings,
        completedBookings,
        activeBookings,
        cancelledBookings,
        averageBookingValue,
        cancellationRate,
        fleetSize: fleet.length,
        fleetUtilizationRate: utilizationRate,
      },

      bookingStatus: sortedMap(
        bookingStatus,
        ([status, count]) => ({ status, count }),
      ),

      paymentStatus: sortedMap(
        paymentStatus,
        ([status, count]) => ({ status, count }),
      ),

      paymentMethods: sortedMap(
        paymentMethods,
        ([method, count]) => ({ method, count }),
      ),

      fleetStatus: sortedMap(
        fleetStatus,
        ([status, count]) => ({ status, count }),
      ),

      bookingTrend: sortedMap(
        bookingTrend,
        ([date, count]) => ({ date, count }),
      ),

      revenueTrend: sortedMap(
        authoritativeRevenueTrend,
        ([date, amount]) => ({
          date,
          amount: roundMoney(amount),
        }),
      ),

      topCars: topValues(carPerformance),
      topBranches: topValues(branchPerformance),
      topCities: topValues(cityPerformance),

      generatedAt: new Date().toISOString(),
    };
  },
};

module.exports = { AnalyticsService, MONEY_STATUSES };
