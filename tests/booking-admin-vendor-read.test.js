'use strict';

const request = require('supertest');
const { v4: uuid } = require('uuid');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedRole, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

const auth = (user) => ({ Authorization: `Bearer ${signAccessToken({ sub: user.id, type: 'access' })}` });

async function createVendor(name) {
  return prisma.vendor.create({
    data: {
      vendorCode: `V-${uuid()}`,
      companyName: name,
      taxId: 'private-tax-id',
      gstin: 'private-gstin',
    },
  });
}

async function createCar(vendor, overrides = {}) {
  return prisma.car.create({
    data: {
      vendorId: vendor.id,
      branchId: uuid(),
      registrationNumber: `REG-${uuid()}`,
      brand: 'Tata',
      model: 'Nexon',
      variant: 'XZ',
      manufacturingYear: 2025,
      fuelType: 'petrol',
      transmission: 'manual',
      seatingCapacity: 5,
      status: 'available',
      odometer: 100,
      ...overrides,
    },
  });
}

async function createBooking({ customer, vendor, car, ...overrides }) {
  const startAt = overrides.startAt || new Date('2030-01-10T10:00:00.000Z');
  return prisma.booking.create({
    data: {
      bookingNumber: `BK-${uuid()}`,
      userId: customer.id,
      vendorId: vendor.id,
      carId: car.id,
      startAt,
      endAt: overrides.endAt || new Date(new Date(startAt).getTime() + 3600000),
      subtotal: 900,
      tax: 50,
      discount: 25,
      securityDeposit: 500,
      totalAmount: 925,
      currencyCode: 'INR',
      status: 'CONFIRMED',
      paymentStatus: 'succeeded',
      holdExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      idempotencyKey: `private-booking-key-${uuid()}`,
      idempotencyHash: 'private-booking-hash',
      ...overrides,
    },
  });
}

describe('admin and vendor booking reads', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetStore();
  });

  it('enforces bookings.view on admin routes and keeps SUPER_ADMIN wildcard access', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    await seedRole('SUPER_ADMIN');
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    const customer = await seedUser({ email: `${uuid()}@test.dev` });
    const superAdmin = await seedUser({ email: `${uuid()}@test.dev`, roles: ['SUPER_ADMIN'] });
    const vendor = await createVendor('Global Vendor');
    const car = await createCar(vendor);
    const booking = await createBooking({ customer, vendor, car });

    const list = await request(app).get('/api/v1/admin/bookings').set(auth(viewer));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(
      (await request(app).get(`/api/v1/admin/bookings/${booking.id}`).set(auth(viewer))).status,
    ).toBe(200);
    expect((await request(app).get('/api/v1/admin/bookings').set(auth(customer))).status).toBe(403);
    expect(
      (await request(app).get(`/api/v1/admin/bookings/${booking.id}`).set(auth(customer))).status,
    ).toBe(403);
    expect((await request(app).get('/api/v1/admin/bookings').set(auth(superAdmin))).status).toBe(200);
  });

  it('scopes vendor list and detail to every VendorMember record', async () => {
    await seedRole('VENDOR_VIEWER', { permissions: ['bookings.view'] });
    const operator = await seedUser({ email: `${uuid()}@test.dev`, roles: ['VENDOR_VIEWER'] });
    const customer = await seedUser({ email: `${uuid()}@test.dev` });
    const firstVendor = await createVendor('First Vendor');
    const secondVendor = await createVendor('Second Vendor');
    const foreignVendor = await createVendor('Foreign Vendor');
    await prisma.vendorMember.create({ data: { vendorId: firstVendor.id, userId: operator.id } });
    await prisma.vendorMember.create({ data: { vendorId: secondVendor.id, userId: operator.id } });
    const first = await createBooking({
      customer,
      vendor: firstVendor,
      car: await createCar(firstVendor),
    });
    const second = await createBooking({
      customer,
      vendor: secondVendor,
      car: await createCar(secondVendor),
    });
    const foreign = await createBooking({
      customer,
      vendor: foreignVendor,
      car: await createCar(foreignVendor),
    });

    const all = await request(app).get('/api/v1/vendor/bookings').set(auth(operator));
    expect(all.status).toBe(200);
    expect(all.body.data.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
    expect(
      (
        await request(app)
          .get(`/api/v1/vendor/bookings?vendorId=${firstVendor.id}`)
          .set(auth(operator))
      ).body.data.map((item) => item.id),
    ).toEqual([first.id]);
    expect(
      (
        await request(app)
          .get(`/api/v1/vendor/bookings?vendorId=${foreignVendor.id}`)
          .set(auth(operator))
      ).body.data,
    ).toEqual([]);
    expect(
      (await request(app).get(`/api/v1/vendor/bookings/${second.id}`).set(auth(operator))).status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/v1/vendor/bookings/${foreign.id}`).set(auth(operator))).status,
    ).toBe(404);
  });

  it('does not grant vendor reads from broad permission without membership', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    await seedRole('SUPER_ADMIN');
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    const superAdmin = await seedUser({ email: `${uuid()}@test.dev`, roles: ['SUPER_ADMIN'] });
    const customer = await seedUser({ email: `${uuid()}@test.dev` });
    const vendor = await createVendor('Tenant Vendor');
    const booking = await createBooking({ customer, vendor, car: await createCar(vendor) });

    for (const user of [viewer, superAdmin]) {
      const list = await request(app).get('/api/v1/vendor/bookings').set(auth(user));
      expect(list.status).toBe(200);
      expect(list.body.data).toEqual([]);
      expect(list.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
      expect(
        (await request(app).get(`/api/v1/vendor/bookings/${booking.id}`).set(auth(user))).status,
      ).toBe(404);
    }
  });

  it('supports validated admin list filters, pagination, and allow-listed sorting', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    const customer = await seedUser({ email: `${uuid()}@test.dev` });
    const otherCustomer = await seedUser({ email: `${uuid()}@test.dev` });
    const firstVendor = await createVendor('Filter Vendor');
    const secondVendor = await createVendor('Other Vendor');
    const firstCar = await createCar(firstVendor);
    const secondCar = await createCar(secondVendor);
    const first = await createBooking({
      customer,
      vendor: firstVendor,
      car: firstCar,
      bookingNumber: 'BK-FILTER-ONE',
      startAt: new Date('2030-01-10T10:00:00.000Z'),
      status: 'CONFIRMED',
      paymentStatus: 'succeeded',
      totalAmount: 100,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    const second = await createBooking({
      customer: otherCustomer,
      vendor: secondVendor,
      car: secondCar,
      bookingNumber: 'BK-FILTER-TWO',
      startAt: new Date('2030-02-10T10:00:00.000Z'),
      status: 'PAYMENT_PENDING',
      paymentStatus: 'pending',
      totalAmount: 200,
      createdAt: new Date('2030-01-02T00:00:00.000Z'),
    });

    const cases = [
      [`bookingNumber=${first.bookingNumber}`, first.id],
      ['search=FILTER-TWO', second.id],
      ['status=CONFIRMED', first.id],
      ['paymentStatus=pending', second.id],
      [`vendorId=${firstVendor.id}`, first.id],
      [`carId=${secondCar.id}`, second.id],
      [`userId=${customer.id}`, first.id],
      ['startFrom=2030-02-01T00%3A00%3A00.000Z', second.id],
      ['startTo=2030-01-31T23%3A59%3A59.000Z', first.id],
    ];
    for (const [query, expectedId] of cases) {
      const response = await request(app).get(`/api/v1/admin/bookings?${query}`).set(auth(viewer));
      expect(response.status).toBe(200);
      expect(response.body.data.map((item) => item.id)).toEqual([expectedId]);
    }

    const sorted = await request(app)
      .get('/api/v1/admin/bookings?sortBy=totalAmount&sortOrder=desc&page=1&limit=1')
      .set(auth(viewer));
    expect(sorted.status).toBe(200);
    expect(sorted.body.data[0].id).toBe(second.id);
    expect(sorted.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it.each([
    'status=UNKNOWN',
    'paymentStatus=UNKNOWN',
    'vendorId=not-a-uuid',
    'carId=not-a-uuid',
    'userId=not-a-uuid',
    'startFrom=not-a-date',
    'startTo=not-a-date',
    'startFrom=2030-02-01T00%3A00%3A00.000Z&startTo=2030-01-01T00%3A00%3A00.000Z',
    'sortBy=id',
    'sortOrder=sideways',
    'limit=101',
  ])('rejects unsafe admin list query: %s', async (query) => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    expect(
      (await request(app).get(`/api/v1/admin/bookings?${query}`).set(auth(viewer))).status,
    ).toBe(422);
  });

  it('does not accept an arbitrary customer filter on vendor lists', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    expect(
      (await request(app).get(`/api/v1/vendor/bookings?userId=${uuid()}`).set(auth(viewer))).status,
    ).toBe(422);
  });

  it('derives pickup eligibility separately from caller pickup authority', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    await seedRole('BOOKING_OPERATOR', {
      permissions: ['bookings.view', 'bookings.operate'],
    });
    await seedRole('SUPER_ADMIN');
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    const operator = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_OPERATOR'] });
    const superAdmin = await seedUser({ email: `${uuid()}@test.dev`, roles: ['SUPER_ADMIN'] });
    const customer = await seedUser({ email: `${uuid()}@test.dev` });
    const vendor = await createVendor('Pickup Vendor');
    await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: operator.id } });

    const eligibleCar = await createCar(vendor);
    const eligible = await createBooking({ customer, vendor, car: eligibleCar });
    const paymentPending = await createBooking({
      customer,
      vendor,
      car: await createCar(vendor),
      paymentStatus: 'pending',
    });
    const bookingPending = await createBooking({
      customer,
      vendor,
      car: await createCar(vendor),
      status: 'PAYMENT_PENDING',
    });
    const maintenance = await createBooking({
      customer,
      vendor,
      car: await createCar(vendor, { status: 'maintenance' }),
    });
    const active = await createBooking({
      customer,
      vendor,
      car: await createCar(vendor),
      status: 'ACTIVE',
    });
    const tripStarted = await createBooking({
      customer,
      vendor,
      car: await createCar(vendor),
    });
    await prisma.tripHistory.create({
      data: {
        bookingId: tripStarted.id,
        tripStatus: 'active',
        startTime: new Date('2030-01-10T10:00:00.000Z'),
      },
    });

    const viewerRows = (
      await request(app).get('/api/v1/admin/bookings?limit=100').set(auth(viewer))
    ).body.data;
    const byId = new Map(viewerRows.map((row) => [row.id, row]));
    expect(byId.get(eligible.id).capabilities).toEqual({
      pickupEligible: true,
      canPickup: false,
    });
    for (const booking of [paymentPending, bookingPending, maintenance, active, tripStarted]) {
      expect(byId.get(booking.id).capabilities.pickupEligible).toBe(false);
    }

    const vendorDetail = await request(app)
      .get(`/api/v1/vendor/bookings/${eligible.id}`)
      .set(auth(operator));
    expect(vendorDetail.body.data.capabilities).toEqual({ pickupEligible: true, canPickup: true });
    const adminDetail = await request(app)
      .get(`/api/v1/admin/bookings/${eligible.id}`)
      .set(auth(operator));
    expect(adminDetail.body.data.capabilities.canPickup).toBe(true);
    const superDetail = await request(app)
      .get(`/api/v1/admin/bookings/${eligible.id}`)
      .set(auth(superAdmin));
    expect(superDetail.body.data.capabilities.canPickup).toBe(true);
  });

  it('returns a complete safe detail aggregate without private fields', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    const viewer = await seedUser({
      email: `${uuid()}@test.dev`,
      roles: ['BOOKING_VIEWER'],
      password: 'PrivatePassword123!',
    });
    const customer = await seedUser({
      email: `${uuid()}@test.dev`,
      password: 'CustomerPrivate123!',
    });
    await prisma.profile.update({
      where: { userId: customer.id },
      data: { verificationStatus: 'verified' },
    });
    const vendor = await createVendor('Aggregate Vendor');
    const car = await createCar(vendor);
    const pickup = await prisma.location.create({
      data: { cityId: uuid(), vendorId: vendor.id, name: 'Airport Pickup' },
    });
    const dropoff = await prisma.location.create({
      data: { cityId: uuid(), vendorId: vendor.id, name: 'Station Dropoff' },
    });
    const booking = await createBooking({
      customer,
      vendor,
      car,
      pickupLocationId: pickup.id,
      dropoffLocationId: dropoff.id,
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId: customer.id,
        amount: 925,
        currencyCode: 'INR',
        status: 'succeeded',
        operationalStatus: 'normal',
        paymentMethod: 'card',
        providerOrderId: 'private-order',
        providerPaymentId: 'private-payment',
        transactionReference: 'private-transaction',
        paidAt: new Date('2030-01-01T00:00:00.000Z'),
      },
    });
    await prisma.refund.create({
      data: {
        bookingId: booking.id,
        paymentId: payment.id,
        amount: 100,
        currencyCode: 'INR',
        status: 'pending',
        reason: 'Adjustment',
        providerReference: 'private-refund-reference',
        idempotencyKey: 'private-refund-key',
      },
    });
    await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${uuid()}`,
        bookingId: booking.id,
        userId: customer.id,
        vendorId: vendor.id,
        subtotal: 900,
        tax: 50,
        discount: 25,
        total: 925,
        currencyCode: 'INR',
        status: 'issued',
        invoiceDate: new Date('2030-01-01T00:00:00.000Z'),
      },
    });
    await prisma.tripHistory.create({
      data: {
        bookingId: booking.id,
        tripStatus: 'active',
        startTime: new Date('2030-01-10T10:00:00.000Z'),
        startOdometer: 100,
        startFuel: 80,
        startedBy: viewer.id,
        pickupNotes: 'Checked out',
      },
    });
    await prisma.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
        changedBy: viewer.id,
        reason: 'Paid',
        createdAt: new Date('2030-01-02T00:00:00.000Z'),
      },
    });
    await prisma.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: null,
        toStatus: 'PENDING',
        changedBy: customer.id,
        reason: 'Created',
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
      },
    });

    const response = await request(app)
      .get(`/api/v1/admin/bookings/${booking.id}`)
      .set(auth(viewer));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      booking: { id: booking.id, bookingNumber: booking.bookingNumber },
      customer: { id: customer.id, verificationStatus: 'verified' },
      vendor: { id: vendor.id, companyName: vendor.companyName },
      car: { id: car.id, registrationNumber: car.registrationNumber },
      pickupLocation: { id: pickup.id, name: pickup.name },
      dropoffLocation: { id: dropoff.id, name: dropoff.name },
      payments: [{ id: payment.id, method: 'card' }],
      refunds: [{ reason: 'Adjustment' }],
      invoice: { total: 925 },
      tripHistory: { startedBy: { id: viewer.id, email: viewer.email } },
      capabilities: { pickupEligible: false, canPickup: false },
    });
    expect(response.body.data.statusHistory.map((entry) => entry.reason)).toEqual([
      'Created',
      'Paid',
    ]);
    expect(response.body.data.statusHistory[0].changedBy).toMatchObject({ id: customer.id });

    const json = JSON.stringify(response.body);
    for (const forbidden of [
      'idempotencyKey',
      'idempotencyHash',
      'providerPaymentId',
      'providerOrderId',
      'providerReference',
      'transactionReference',
      'storageKey',
      'taxId',
      'gstin',
      'accountNumber',
      'passwordHash',
      'refreshToken',
      'webhook',
      'documentUrl',
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('returns 404 for missing detail and preserves customer ownership routes', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    const owner = await seedUser({ email: `${uuid()}@test.dev` });
    const other = await seedUser({ email: `${uuid()}@test.dev` });
    const vendor = await createVendor('Customer Isolation Vendor');
    const booking = await createBooking({ customer: owner, vendor, car: await createCar(vendor) });

    expect(
      (await request(app).get(`/api/v1/admin/bookings/${uuid()}`).set(auth(viewer))).status,
    ).toBe(404);
    const mine = await request(app).get('/api/v1/bookings/me').set(auth(owner));
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((item) => item.id)).toEqual([booking.id]);
    expect(
      (await request(app).get(`/api/v1/bookings/${booking.id}`).set(auth(other))).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/bookings/${booking.id}`).set(auth(viewer))).status,
    ).toBe(404);
  });

  it('returns valid empty admin pagination metadata', async () => {
    await seedRole('BOOKING_VIEWER', { permissions: ['bookings.view'] });
    const viewer = await seedUser({ email: `${uuid()}@test.dev`, roles: ['BOOKING_VIEWER'] });
    const response = await request(app).get('/api/v1/admin/bookings').set(auth(viewer));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });
});
