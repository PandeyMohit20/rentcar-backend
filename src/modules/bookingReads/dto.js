'use strict';

function customerSummary(customer, verificationStatus) {
  if (!customer) return null;
  const summary = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
  };
  if (verificationStatus !== undefined) summary.verificationStatus = verificationStatus;
  return summary;
}

const vendorSummary = (vendor) =>
  vendor ? { id: vendor.id, companyName: vendor.companyName } : null;

function listCarSummary(car) {
  if (!car) return null;
  return {
    id: car.id,
    registrationNumber: car.registrationNumber,
    brand: car.brand,
    model: car.model,
    status: car.status,
    odometer: car.odometer,
  };
}

function detailCarSummary(car) {
  if (!car) return null;
  return {
    ...listCarSummary(car),
    variant: car.variant,
    fuelType: car.fuelType,
    transmission: car.transmission,
    seatingCapacity: car.seatingCapacity,
    branchId: car.branchId,
  };
}

const locationSummary = (location) =>
  location ? { id: location.id, name: location.name } : null;

const actorSummary = (actor, actorId) => {
  if (!actorId) return null;
  return actor ? { id: actor.id, name: actor.name, email: actor.email } : { id: actorId };
};

function pickupEligible(booking, car, trip) {
  const tripHasStartedOrEnded = Boolean(
    trip && (trip.startTime || trip.endTime || trip.tripStatus === 'active' || trip.tripStatus === 'archived'),
  );
  return Boolean(
    booking.status === 'CONFIRMED' &&
      booking.paymentStatus === 'succeeded' &&
      car &&
      car.status === 'available' &&
      !tripHasStartedOrEnded,
  );
}

function capabilities(booking, car, trip, callerCanPickup) {
  const eligible = pickupEligible(booking, car, trip);
  return { pickupEligible: eligible, canPickup: eligible && callerCanPickup };
}

function listDto(booking, related, callerCanPickup) {
  const customer = related.customers.get(booking.userId);
  const vendor = related.vendors.get(booking.vendorId);
  const car = related.cars.get(booking.carId);
  const trip = related.trips.get(booking.id);
  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    startAt: booking.startAt,
    endAt: booking.endAt,
    totalAmount: booking.totalAmount,
    currencyCode: booking.currencyCode,
    holdExpiresAt: booking.holdExpiresAt,
    createdAt: booking.createdAt,
    customer: customerSummary(customer),
    vendor: vendorSummary(vendor),
    car: listCarSummary(car),
    pickupLocation: locationSummary(related.locations.get(booking.pickupLocationId)),
    dropoffLocation: locationSummary(related.locations.get(booking.dropoffLocationId)),
    capabilities: capabilities(booking, car, trip, callerCanPickup),
  };
}

function detailDto(aggregate, callerCanPickup) {
  const { booking, car, trip, actors } = aggregate;
  return {
    booking: {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      startAt: booking.startAt,
      endAt: booking.endAt,
      subtotal: booking.subtotal,
      tax: booking.tax,
      discount: booking.discount,
      securityDeposit: booking.securityDeposit,
      totalAmount: booking.totalAmount,
      currencyCode: booking.currencyCode,
      holdExpiresAt: booking.holdExpiresAt,
      cancelledAt: booking.cancelledAt,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    },
    customer: customerSummary(
      aggregate.customer,
      aggregate.profile ? aggregate.profile.verificationStatus : undefined,
    ),
    vendor: vendorSummary(aggregate.vendor),
    car: detailCarSummary(car),
    pickupLocation: locationSummary(aggregate.locations.get(booking.pickupLocationId)),
    dropoffLocation: locationSummary(aggregate.locations.get(booking.dropoffLocationId)),
    payments: aggregate.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currencyCode: payment.currencyCode,
      method: payment.paymentMethod,
      status: payment.status,
      operationalStatus: payment.operationalStatus,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    })),
    refunds: aggregate.refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      currencyCode: refund.currencyCode,
      status: refund.status,
      reason: refund.reason,
      processedAt: refund.processedAt,
      failedAt: refund.failedAt,
      failureReason: refund.failureReason,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    })),
    invoice: aggregate.invoice
      ? {
          id: aggregate.invoice.id,
          invoiceNumber: aggregate.invoice.invoiceNumber,
          subtotal: aggregate.invoice.subtotal,
          tax: aggregate.invoice.tax,
          discount: aggregate.invoice.discount,
          total: aggregate.invoice.total,
          currencyCode: aggregate.invoice.currencyCode,
          status: aggregate.invoice.status,
          invoiceDate: aggregate.invoice.invoiceDate,
          dueDate: aggregate.invoice.dueDate,
          createdAt: aggregate.invoice.createdAt,
          updatedAt: aggregate.invoice.updatedAt,
        }
      : null,
    tripHistory: trip
      ? {
          id: trip.id,
          tripStatus: trip.tripStatus,
          startTime: trip.startTime,
          startOdometer: trip.startOdometer,
          startFuel: trip.startFuel,
          startedBy: actorSummary(actors.get(trip.startedBy), trip.startedBy),
          pickupNotes: trip.pickupNotes,
          endTime: trip.endTime,
          endOdometer: trip.endOdometer,
          endFuel: trip.endFuel,
          completedBy: actorSummary(actors.get(trip.completedBy), trip.completedBy),
          returnNotes: trip.returnNotes,
          actualDistance: trip.actualDistance,
        }
      : null,
    statusHistory: aggregate.statusHistory.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      reason: entry.reason,
      createdAt: entry.createdAt,
      changedBy: actorSummary(actors.get(entry.changedBy), entry.changedBy),
    })),
    capabilities: capabilities(booking, car, trip, callerCanPickup),
  };
}

module.exports = { listDto, detailDto };
