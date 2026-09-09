'use strict';

const { prisma } = require('../../config/database');

const bookingListSelect = {
  id: true,
  bookingNumber: true,
  userId: true,
  vendorId: true,
  carId: true,
  pickupLocationId: true,
  dropoffLocationId: true,
  status: true,
  paymentStatus: true,
  startAt: true,
  endAt: true,
  totalAmount: true,
  currencyCode: true,
  holdExpiresAt: true,
  createdAt: true,
};

const bookingDetailSelect = {
  ...bookingListSelect,
  financialSnapshot: true,
  subtotal: true,
  tax: true,
  discount: true,
  securityDeposit: true,
  cancelledAt: true,
  cancellationReason: true,
  updatedAt: true,
};

const customerSelect = { id: true, name: true, email: true, phone: true };
const actorSelect = { id: true, name: true, email: true };
const vendorSelect = { id: true, companyName: true };
const listCarSelect = {
  id: true,
  registrationNumber: true,
  brand: true,
  model: true,
  status: true,
  odometer: true,
};
const detailCarSelect = {
  ...listCarSelect,
  variant: true,
  fuelType: true,
  transmission: true,
  seatingCapacity: true,
  branchId: true,
};
const locationSelect = { id: true, name: true };
const listTripSelect = {
  id: true,
  bookingId: true,
  tripStatus: true,
  startTime: true,
  endTime: true,
};
const detailTripSelect = {
  ...listTripSelect,
  startOdometer: true,
  startFuel: true,
  startedBy: true,
  pickupNotes: true,
  endOdometer: true,
  endFuel: true,
  completedBy: true,
  returnNotes: true,
  actualDistance: true,
};

const unique = (values) => [...new Set(values.filter(Boolean))];
const indexBy = (records, key = 'id') => new Map(records.map((record) => [record[key], record]));

async function findVendorIdsForUser(userId) {
  const memberships = await prisma.vendorMember.findMany({
    where: { userId },
    select: { vendorId: true },
  });
  return unique(memberships.map((membership) => membership.vendorId));
}

async function list(where, { skip, take, sortBy, sortOrder }) {
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: bookingListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);

  if (bookings.length === 0) return { bookings, total, related: emptyListRelations() };

  const customerIds = unique(bookings.map((booking) => booking.userId));
  const vendorIds = unique(bookings.map((booking) => booking.vendorId));
  const carIds = unique(bookings.map((booking) => booking.carId));
  const bookingIds = bookings.map((booking) => booking.id);
  const locationIds = unique(
    bookings.flatMap((booking) => [booking.pickupLocationId, booking.dropoffLocationId]),
  );

  const [customers, vendors, cars, trips, locations] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: customerIds } }, select: customerSelect }),
    prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: vendorSelect }),
    prisma.car.findMany({ where: { id: { in: carIds } }, select: listCarSelect }),
    prisma.tripHistory.findMany({ where: { bookingId: { in: bookingIds } }, select: listTripSelect }),
    locationIds.length
      ? prisma.location.findMany({ where: { id: { in: locationIds } }, select: locationSelect })
      : [],
  ]);

  return {
    bookings,
    total,
    related: {
      customers: indexBy(customers),
      vendors: indexBy(vendors),
      cars: indexBy(cars),
      trips: indexBy(trips, 'bookingId'),
      locations: indexBy(locations),
    },
  };
}

function emptyListRelations() {
  return {
    customers: new Map(),
    vendors: new Map(),
    cars: new Map(),
    trips: new Map(),
    locations: new Map(),
  };
}

async function findAdminDetail(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: bookingDetailSelect,
  });
  return booking ? hydrateDetail(booking) : null;
}

async function findVendorDetail(bookingId, vendorIds) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, vendorId: { in: vendorIds } },
    select: bookingDetailSelect,
  });
  return booking ? hydrateDetail(booking) : null;
}

async function hydrateDetail(booking) {
  const locationIds = unique([booking.pickupLocationId, booking.dropoffLocationId]);
  const [customer, profile, vendor, car, locations, payments, refunds, invoice, trip, statusHistory] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: booking.userId }, select: customerSelect }),
      prisma.profile.findUnique({
        where: { userId: booking.userId },
        select: { verificationStatus: true },
      }),
      prisma.vendor.findUnique({ where: { id: booking.vendorId }, select: vendorSelect }),
      prisma.car.findUnique({ where: { id: booking.carId }, select: detailCarSelect }),
      locationIds.length
        ? prisma.location.findMany({ where: { id: { in: locationIds } }, select: locationSelect })
        : [],
      prisma.payment.findMany({
        where: { bookingId: booking.id },
        select: {
          id: true,
          amount: true,
          currencyCode: true,
          paymentMethod: true,
          status: true,
          operationalStatus: true,
          paidAt: true,
          failedAt: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refund.findMany({
        where: { bookingId: booking.id },
        select: {
          id: true,
          amount: true,
          currencyCode: true,
          status: true,
          reason: true,
          processedAt: true,
          failedAt: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findFirst({
        where: { bookingId: booking.id },
        select: {
          id: true,
          invoiceNumber: true,
          snapshot: true,
          subtotal: true,
          tax: true,
          discount: true,
          total: true,
          currencyCode: true,
          status: true,
          invoiceDate: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.tripHistory.findUnique({
        where: { bookingId: booking.id },
        select: detailTripSelect,
      }),
      prisma.bookingStatusHistory.findMany({
        where: { bookingId: booking.id },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          changedBy: true,
          reason: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

  const actorIds = unique([
    trip && trip.startedBy,
    trip && trip.completedBy,
    ...statusHistory.map((entry) => entry.changedBy),
  ]);
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: actorSelect })
    : [];

  return {
    booking,
    customer,
    profile,
    vendor,
    car,
    locations: indexBy(locations),
    payments,
    refunds,
    invoice,
    trip,
    statusHistory,
    actors: indexBy(actors),
  };
}

module.exports = {
  findVendorIdsForUser,
  list,
  findAdminDetail,
  findVendorDetail,
};
