'use strict';

const InventoryRepository = require('./repository');

const BUSINESS_TIMEZONE = 'Asia/Kolkata';

const BLOCKING_BOOKING_STATUSES = new Set(['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'ACTIVE']);

const BLOCKING_AVAILABILITY_STATUSES = new Set(['unavailable', 'maintenance', 'blocked']);

function getVendorName(vendor) {
  if (!vendor) {
    return null;
  }

  return vendor.companyName || vendor.legalName || null;
}

function mapInventoryRow(car) {
  const latestAvailability = car.availabilities?.[0] || null;

  return {
    id: car.id,
    carId: car.id,

    registrationNumber: car.registrationNumber,

    name: [car.brand, car.model].filter(Boolean).join(' '),

    brand: car.brand,
    model: car.model,
    variant: car.variant,

    manufacturingYear: car.manufacturingYear,
    fuelType: car.fuelType,
    transmission: car.transmission,
    seatingCapacity: car.seatingCapacity,

    status: car.status,
    odometer: car.odometer,

    vendor: car.vendor
      ? {
          id: car.vendor.id,
          name: getVendorName(car.vendor),
        }
      : null,

    branch: car.branch
      ? {
          id: car.branch.id,
          name: car.branch.name,
          city: car.branch.city,
        }
      : null,

    image: car.images?.[0] || null,

    availability: latestAvailability
      ? {
          id: latestAvailability.id,
          date: latestAvailability.date,
          startTime: latestAvailability.startTime,
          endTime: latestAvailability.endTime,
          status: latestAvailability.status,
          reason: latestAvailability.reason,
        }
      : null,

    bookingCount: car._count?.bookings || 0,

    createdAt: car.createdAt,
    updatedAt: car.updatedAt,
  };
}

async function listInventory(filters = {}) {
  const cars = await InventoryRepository.findInventory(filters);

  return {
    rows: cars.map(mapInventoryRow),
    total: cars.length,
  };
}

async function getStats() {
  const [total, groups] = await Promise.all([
    InventoryRepository.countCars(),
    InventoryRepository.getStatusCounts(),
  ]);

  const statusCounts = {
    available: 0,
    booked: 0,
    busy: 0,
    maintenance: 0,
    inactive: 0,
    retired: 0,
  };

  for (const group of groups) {
    statusCounts[group.status] = group._count?._all || 0;
  }

  return {
    total,

    available: statusCounts.available,

    booked: statusCounts.booked,

    busy: statusCounts.busy,

    maintenance: statusCounts.maintenance,

    inactive: statusCounts.inactive,

    retired: statusCounts.retired,

    unavailable:
      statusCounts.booked +
      statusCounts.busy +
      statusCounts.maintenance +
      statusCounts.inactive +
      statusCounts.retired,

    statusCounts,
  };
}

function bookingBlocksInventory(booking) {
  if (!BLOCKING_BOOKING_STATUSES.has(booking.status)) {
    return false;
  }

  if (booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING') {
    return Boolean(booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() > Date.now());
  }

  return true;
}

function mapCalendarCar(car) {
  return {
    id: car.id,
    carId: car.id,

    registrationNumber: car.registrationNumber,

    name: [car.brand, car.model].filter(Boolean).join(' '),

    brand: car.brand,
    model: car.model,
    variant: car.variant,

    status: car.status,

    vendor: car.vendor
      ? {
          id: car.vendor.id,
          name: getVendorName(car.vendor),
        }
      : null,

    branch: car.branch
      ? {
          id: car.branch.id,
          name: car.branch.name,
          city: car.branch.city,
        }
      : null,
  };
}

function mapBookingEvent(booking) {
  return {
    id: `booking:${booking.id}`,
    sourceId: booking.id,
    type: 'booking',

    carId: booking.carId,

    bookingNumber: booking.bookingNumber,

    status: booking.status,
    paymentStatus: booking.paymentStatus,

    start: booking.startAt,
    end: booking.endAt,

    holdExpiresAt: booking.holdExpiresAt,

    blocking: bookingBlocksInventory(booking),

    amount: booking.totalAmount,
    currencyCode: booking.currencyCode,
  };
}

function mapAvailabilityEvent(record) {
  return {
    id: `availability:${record.id}`,
    sourceId: record.id,
    type: 'availability',

    carId: record.carId,

    status: record.status,
    reason: record.reason,

    date: record.date,

    start: record.startTime || null,
    end: record.endTime || null,

    allDay: !record.startTime || !record.endTime,

    blocking: BLOCKING_AVAILABILITY_STATUSES.has(record.status),
  };
}

async function getCalendar(filters) {
  const data = await InventoryRepository.findCalendarData(filters);

  const bookingEvents = data.bookings.map(mapBookingEvent);

  const availabilityEvents = data.availabilities.map(mapAvailabilityEvent);

  const events = [...bookingEvents, ...availabilityEvents].sort((left, right) => {
    const leftDate = new Date(left.start || left.date || 0).getTime();

    const rightDate = new Date(right.start || right.date || 0).getTime();

    return leftDate - rightDate;
  });

  const blockingEvents = events.filter((event) => event.blocking);

  return {
    timezone: BUSINESS_TIMEZONE,

    range: {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },

    cars: data.cars.map(mapCalendarCar),

    events,

    summary: {
      totalCars: data.cars.length,
      totalEvents: events.length,
      bookingEvents: bookingEvents.length,
      availabilityEvents: availabilityEvents.length,
      blockingEvents: blockingEvents.length,
    },
  };
}

module.exports = {
  listInventory,
  getStats,
  getCalendar,
  mapInventoryRow,
  bookingBlocksInventory,
};
