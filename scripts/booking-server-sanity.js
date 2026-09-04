'use strict';
/* eslint-disable no-console */

const http = require('http');
const { prisma } = require('../src/config/database');
const { signAccessToken } = require('../src/utils/jwt');

const suffix = `P4A-HTTP-${Date.now()}`;
const ids = {};

function request(method, path, { token, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const requestHeaders = { ...headers };
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    if (payload) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: '127.0.0.1', port: 5000, method, path, headers: requestHeaders }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let data;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.once('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (!ids.car) return;
  const bookings = await prisma.booking.findMany({ where: { carId: ids.car }, select: { id: true } }).catch(() => []);
  const bookingIds = bookings.map((booking) => booking.id);
  if (bookingIds.length) {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
    await prisma.bookingItem.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
  }
  await prisma.booking.deleteMany({ where: { carId: ids.car } }).catch(() => {});
  await prisma.carPricing.deleteMany({ where: { carId: ids.car } }).catch(() => {});
  await prisma.car.deleteMany({ where: { id: ids.car } }).catch(() => {});
  await prisma.branch.deleteMany({ where: { id: ids.branch } }).catch(() => {});
  await prisma.location.deleteMany({ where: { id: ids.location } }).catch(() => {});
  await prisma.city.deleteMany({ where: { id: ids.city } }).catch(() => {});
  await prisma.vendor.deleteMany({ where: { id: ids.vendor } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: ids.user } }).catch(() => {});
}

async function main() {
  const health = await request('GET', '/api/v1/health');
  assert(health.status === 200, `Health expected 200, received ${health.status}`);

  const user = await prisma.user.create({ data: { name: suffix, email: `${suffix}@example.test`, passwordHash: 'x', status: 'active' } });
  const vendor = await prisma.vendor.create({ data: { vendorCode: `${suffix}-V`, companyName: suffix, status: 'active' } });
  const city = await prisma.city.create({ data: { name: suffix, status: 'active' } });
  const location = await prisma.location.create({ data: { cityId: city.id, vendorId: vendor.id, name: suffix, status: 'active' } });
  const branch = await prisma.branch.create({ data: { locationId: location.id, vendorId: vendor.id, name: suffix, status: 'active' } });
  const car = await prisma.car.create({ data: { vendorId: vendor.id, branchId: branch.id, registrationNumber: `${suffix}-CAR`, brand: 'Phase', model: 'Sanity', manufacturingYear: 2025, status: 'available' } });
  ids.user = user.id; ids.vendor = vendor.id; ids.city = city.id; ids.location = location.id; ids.branch = branch.id; ids.car = car.id;
  await prisma.carPricing.create({ data: { carId: car.id, dailyPrice: 1000, securityDeposit: 500, currencyCode: 'INR', status: 'active' } });

  const token = signAccessToken({ sub: user.id });
  const pickupDateTime = '2030-01-10T10:00:00+05:30';
  const returnDateTime = '2030-01-11T10:00:00+05:30';
  const quote = await request('POST', '/api/v1/pricing/quote', { token, body: { carId: car.id, pickupDateTime, returnDateTime } });
  assert(quote.status === 201 && quote.data?.data?.quoteToken, `Quote expected 201, received ${quote.status}`);

  const idempotencyKey = `${suffix}-key`;
  const booking = await request('POST', '/api/v1/bookings', { token, headers: { 'Idempotency-Key': idempotencyKey }, body: { quoteToken: quote.data.data.quoteToken } });
  assert(booking.status === 201 && booking.data?.data?.id, `Booking expected 201, received ${booking.status}`);
  const bookingData = booking.data.data;
  assert(!Object.hasOwn(bookingData, 'idempotencyHash'), 'Booking DTO exposed idempotencyHash');

  const stored = await prisma.booking.findUnique({ where: { id: bookingData.id } });
  assert(stored && stored.userId === user.id && stored.carId === car.id, 'Stored booking has incorrect owner or car');
  assert(stored.startAt.toISOString() === new Date(pickupDateTime).toISOString() && stored.endAt.toISOString() === new Date(returnDateTime).toISOString(), 'Stored booking interval differs from quote');
  assert(stored.status === 'PAYMENT_PENDING' && stored.paymentStatus === 'pending', 'Stored booking status is incorrect');
  assert(stored.holdExpiresAt > new Date() && Number(stored.subtotal) === 1000 && Number(stored.securityDeposit) === 500 && Number(stored.totalAmount) === 1500 && stored.currencyCode === 'INR', 'Stored quote-derived values are incorrect');

  const own = await request('GET', '/api/v1/bookings/me', { token });
  assert(own.status === 200 && own.data?.data?.some((item) => item.id === bookingData.id), `Own bookings expected 200 and booking, received ${own.status}`);
  const detail = await request('GET', `/api/v1/bookings/${bookingData.id}`, { token });
  assert(detail.status === 200 && detail.data?.data?.id === bookingData.id && !Object.hasOwn(detail.data.data, 'idempotencyHash'), `Detail expected 200, received ${detail.status}`);

  const replay = await request('POST', '/api/v1/bookings', { token, headers: { 'Idempotency-Key': idempotencyKey }, body: { quoteToken: quote.data.data.quoteToken } });
  assert(replay.status === 200 && replay.data?.data?.id === bookingData.id, `Replay expected 200 with same booking, received ${replay.status}`);
  const matchingBookings = await prisma.booking.findMany({ where: { userId: user.id, idempotencyKey } });
  assert(matchingBookings.length === 1 && matchingBookings[0].holdExpiresAt.getTime() === stored.holdExpiresAt.getTime(), 'Replay created a duplicate or changed hold expiry');

  console.log(`PASS server sanity: health ${health.status}, quote ${quote.status}, create ${booking.status}, list ${own.status}, detail ${detail.status}, replay ${replay.status}; booking ${bookingData.id}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
