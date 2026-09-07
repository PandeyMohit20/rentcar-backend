'use strict';
// All fleet writes use authenticated HTTP APIs. Prisma is used for read-only safety checks.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const assert = require('assert/strict');
const fixtures = require('./uat-fleet-data');
const vendorId = '564ebf45-1cae-4ca1-a29e-d4794733b57c';
const branchId = 'd5f9c996-6a74-47d0-b2e3-2a75688486a9';
const camryId = 'dc96154a-7035-481b-b335-8fccb6f4d310';
const root = 'http://localhost:5000/api/v1';
const origin = new URL(root).origin;
const start = '2026-09-01T00:00:00+05:30';
const split = '2026-10-01T00:00:00+05:30';
const septemberEnd = '2026-09-30T23:59:59.999+05:30';
const slug = (fixture, view) => `${fixture.brand}-${fixture.model}-${view}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const log = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const same = (record, body) => Object.entries(body).every(([key, value]) => {
  if (key === 'effectiveFrom' || key === 'effectiveTo') return value === null ? record[key] === null : new Date(record[key]).getTime() === new Date(value).getTime();
  return typeof value === 'number' ? Number(record[key]) === value : record[key] === value;
});

async function main() {
  assert.equal(process.env.NODE_ENV, 'development', 'Refusing non-development environment');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname), 'Refusing non-local database');
  assert.equal(process.platform, 'win32', 'Windows DPAPI credentials and fixture generator required');
  assert(!process.env.TEST_DATABASE_MOCK || process.env.TEST_DATABASE_MOCK === 'false', 'Mock database forbidden');
  const lockPath = path.join(os.tmpdir(), 'rentcar-uat-fleet-seed.lock');
  const lock = fs.openSync(lockPath, 'wx');
  const { prisma } = require('../src/config/database');
  let token;
  const uploadedThisRun = [];
  const counts = { carsCreated: 0, carsUpdated: 0, carsExisting: 0, pricesCreated: 0, pricesUpdated: 0, pricesExisting: 0, featuresCreated: 0, featuresReused: 0, imagesCreated: 0, imagesReused: 0, availabilityCreated: 0 };
  const api = async (method, endpoint, body) => {
    const multipart = body instanceof FormData;
    const response = await fetch(root + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? multipart ? body : JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(`${method} ${endpoint.split('?')[0]} failed: HTTP ${response.status}; ${result.error?.code || 'REQUEST_FAILED'}`);
    return result;
  };
  const list = async (endpoint) => {
    const result = [];
    for (let page = 1; ; page++) {
      const response = await api('GET', `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=100`);
      assert(Array.isArray(response.data));
      result.push(...response.data);
      if (!response.meta || page >= (response.meta.totalPages || 1)) return result;
    }
  };
  try {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, include: { vendor: true, location: true } });
    assert(branch && branch.vendorId === vendorId && branch.status === 'active' && branch.isOperational && !branch.isDeleted);
    assert(branch.vendor.status === 'active' && !branch.vendor.isDeleted && branch.location.status === 'active' && !branch.location.isDeleted);
    const original = await prisma.car.findUnique({ where: { id: camryId } });
    assert(original && !original.isDeleted && original.registrationNumber === 'REG-3936A9796012' && original.vendorId === vendorId && original.branchId === branchId);
    const credential = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference=\'Stop\'; $c=Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA \'RentCarUAT/admin-credential.xml\'); @{email=$c.UserName;password=$c.GetNetworkCredential().Password} | ConvertTo-Json -Compress'],
    { encoding: 'utf8', windowsHide: true });
    assert.equal(credential.status, 0, 'Protected local UAT credential unavailable');
    const credentials = JSON.parse(credential.stdout);
    assert.equal(credentials.email, 'admin@rentcar.local');
    const login = await api('POST', '/auth/login', credentials);
    token = login.data.accessToken;
    assert(token && login.data.user.roles.includes('SUPER_ADMIN'));
    const live = (await api('GET', `/fleet/${camryId}`)).data;
    assert.equal(live.registrationNumber, original.registrationNumber, 'Local API/database mismatch');
    assert.equal(live.branchId, branchId);
    const fixtureImages = fixtures.flatMap((f) => f.views.map((view) => ({ filename: slug(f, view) + '.png', label: `UAT ${f.brand} ${f.model}`, view })));
    const generated = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'generate-uat-fleet-images.ps1')],
      { input: JSON.stringify(fixtureImages) + '\n', encoding: 'utf8', windowsHide: true });
    assert.equal(generated.status, 0, 'PNG fixture generation failed');
    const existingCars = await list('/fleet');
    const report = { environment: { database: 'local development MySQL (credentials omitted)', backend: root }, vendorId, vendor: branch.vendor.companyName, branchId, branch: branch.name, cars: [], counts };
    for (const fixture of fixtures) {
      const { rates, features, views, ...fields } = fixture;
      let car = existingCars.find((c) => c.registrationNumber === fields.registrationNumber);
      const body = { ...fields, vendorId, branchId };
      if (!car) {
        // A deleted registration must never be silently replaced.
        assert(!await prisma.car.findUnique({ where: { registrationNumber: fields.registrationNumber }, select: { id: true } }), 'Registration exists outside visible fleet');
        car = (await api('POST', '/fleet', body)).data;
        counts.carsCreated++;
      } else {
        assert(car.vendorId === vendorId && car.branchId === branchId && car.brand === fields.brand && car.model === fields.model, 'Fixture identity collision');
        assert(car.status === 'available', 'Refusing to override an operational car status');
        // The existing endpoint handles a status-bearing PATCH as a status-only operation.
        // Status is already checked above; send only metadata to preserve this contract.
        const update = Object.fromEntries(Object.entries(fields).filter(([key]) => !['registrationNumber', 'status'].includes(key)));
        if (!same(car, update)) { car = (await api('PATCH', `/fleet/${car.id}`, update)).data; counts.carsUpdated++; }
        else counts.carsExisting++;
      }
      assert(same(car, fields), 'Car metadata did not round-trip through the fleet API');
      if (fixture.model === 'Camry') assert.equal(car.id, camryId);
      const base = `/fleet/${car.id}`;
      const periods = fixture.model === 'Creta'
        ? [{ effectiveFrom: start, effectiveTo: septemberEnd, dailyPrice: rates.dailyPrice }, { effectiveFrom: split, effectiveTo: null, dailyPrice: 3400 }]
        : [{ effectiveFrom: start, effectiveTo: null, dailyPrice: rates.dailyPrice }];
      const prices = await list(base + '/pricing');
      assert(prices.length <= periods.length, 'Unexpected extra pricing rows; manual review required');
      for (const period of periods) {
        let price = prices.find((p) => new Date(p.effectiveFrom).getTime() === new Date(period.effectiveFrom).getTime());
        if (!price && fixture.model === 'Camry' && prices.length === 1) price = prices[0];
        const pricing = { ...rates, currencyCode: 'INR', status: 'active', ...period };
        if (price) {
          if (!same(price, pricing)) { await api('PATCH', base + `/pricing/${price.id}`, pricing); counts.pricesUpdated++; }
          else counts.pricesExisting++;
        } else { assert(prices.length < periods.length, 'Unrecognized pricing period'); prices.push((await api('POST', base + '/pricing', pricing)).data); counts.pricesCreated++; }
      }
      const currentFeatures = await list(base + '/features');
      for (const name of features) {
        if (currentFeatures.some((f) => f.name === name)) counts.featuresReused++;
        else { await api('POST', base + '/features', { name }); counts.featuresCreated++; }
      }
      let images = await list(base + '/images');
      for (const view of views) {
        const altText = `UAT Fleet v1 | ${fixture.brand} ${fixture.model} | ${view}`;
        if (images.some((i) => i.altText === altText)) { counts.imagesReused++; continue; }
        const bytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'uat-fleet', slug(fixture, view) + '.png'));
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Invalid PNG fixture');
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: 'image/png' }), slug(fixture, view) + '.png');
        form.append('altText', altText);
        const image = (await api('POST', base + '/images', form)).data;
        uploadedThisRun.push({ carId: car.id, id: image.id });
        images.push(image);
        counts.imagesCreated++;
      }
      const front = images.find((i) => i.altText === `UAT Fleet v1 | ${fixture.brand} ${fixture.model} | Front`);
      if (fixture.model === 'Camry') {
        await api('PATCH', base + `/images/${images.find((i) => i.id !== front.id).id}/primary`);
        assert.equal((await list(base + '/images')).filter((i) => i.isPrimary).length, 1);
      }
      if (!front.isPrimary || fixture.model === 'Camry' || images.filter((i) => i.isPrimary).length !== 1) await api('PATCH', base + `/images/${front.id}/primary`);
      images = await list(base + '/images');
      assert.equal(images.filter((i) => i.isPrimary).length, 1);
      if (fixture.model === 'Venue') {
        const reason = 'UAT Fleet v1: September availability filter block';
        const configurations = await list(base + '/availability');
        if (!configurations.some((a) => a.reason === reason)) {
          await api('POST', base + '/availability', { date: '2026-09-20', startTime: '2026-09-20T10:00:00+05:30', endTime: '2026-09-22T10:00:00+05:30', status: 'blocked', reason });
          counts.availabilityCreated++;
        }
      }
      const pricing = await list(base + '/pricing');
      const allFeatures = await list(base + '/features');
      const availability = await list(base + '/availability');
      await api('GET', base);
      report.cars.push({ ...fields, id: car.id, pricing, images, features: allFeatures, availability });
      log({ model: fixture.model, ready: true });
    }
    const intendedPickup = new Date('2026-09-08T10:00:00+05:30');
    const pickup = intendedPickup > new Date() ? intendedPickup : new Date(Date.now() + 48 * 3600000);
    const interval = { pickupDateTime: pickup.toISOString(), returnDateTime: new Date(pickup.getTime() + 24 * 3600000).toISOString() };
    report.interval = interval;
    const catalogue = await list('/cars/search');
    const available = (await api('POST', '/availability/search', { ...interval, branchId, limit: 100 })).data;
    const ids = new Set(report.cars.map((c) => c.id));
    report.catalogueCount = catalogue.filter((c) => ids.has(c.id)).length;
    report.availabilityCount = available.filter((c) => ids.has(c.id)).length;
    assert.equal(report.catalogueCount, 15);
    assert(report.availabilityCount >= 10, 'At least ten fixtures must be available for the requested trip');
    let quoteInterval = interval;
    if (report.availabilityCount < 15) {
      report.unavailableForRequestedInterval = report.cars.filter((c) => !available.some((a) => a.id === c.id)).map((c) => ({ id: c.id, model: c.model }));
      let found = false;
      for (let days = 1; days <= 30; days++) {
        const later = new Date(pickup.getTime() + days * 86400000);
        const candidate = { pickupDateTime: later.toISOString(), returnDateTime: new Date(later.getTime() + 86400000).toISOString() };
        const cars = (await api('POST', '/availability/search', { ...candidate, branchId, limit: 100 })).data;
        if (cars.filter((c) => ids.has(c.id)).length === 15) { quoteInterval = candidate; found = true; break; }
      }
      assert(found, 'No common quote interval found; preserve existing bookings');
    }
    report.quoteInterval = quoteInterval;
    report.quotes = [];
    for (const car of report.cars) {
      const selected = car.pricing.filter((p) => p.carId === car.id && p.status === 'active' && p.currencyCode === 'INR' && new Date(p.effectiveFrom) <= new Date(quoteInterval.pickupDateTime) && (!p.effectiveTo || new Date(p.effectiveTo) >= new Date(quoteInterval.returnDateTime)));
      assert.equal(selected.length, 1, 'Exactly one pricing row must cover this UAT trip');
      const quote = (await api('POST', '/pricing/quote', { ...quoteInterval, carId: car.id })).data;
      assert(quote.quoteToken && quote.quoteId && quote.expiresAt && quote.availability.available && quote.duration && quote.pricing && quote.currencyCode === 'INR');
      assert.equal(quote.pricing.pricingId, selected[0].id);
      // Store authoritative breakdown, never the signed bearer quote.
      report.quotes.push({ model: car.model, carId: car.id, tokenReturned: true, quoteId: quote.quoteId, currencyCode: quote.currencyCode, duration: quote.duration, pricing: quote.pricing, expiresAt: quote.expiresAt });
    }
    const creta = report.cars.find((c) => c.model === 'Creta');
    for (const [date, expected] of [['2026-09-15', 3200], ['2026-10-15', 3400]]) {
      const p = new Date(date + 'T10:00:00+05:30');
      const q = (await api('POST', '/pricing/quote', { carId: creta.id, pickupDateTime: p.toISOString(), returnDateTime: new Date(p.getTime() + 86400000).toISOString() })).data;
      assert.equal(q.pricing.rentalSubtotal, expected);
    }
    report.filters = {};
    for (const [key, value, predicate] of [
      ['brand', 'Toyota', (c) => c.brand === 'Toyota'], ['fuelType', 'diesel', (c) => c.fuelType === 'diesel'],
      ['transmission', 'automatic', (c) => c.transmission === 'automatic'], ['seatingCapacity', '7', (c) => c.seatingCapacity >= 7],
      ['branchId', branchId, (c) => c.branch?.id === branchId],
    ]) {
      const cars = await list(`/cars/search?${key}=${encodeURIComponent(value)}`);
      assert(cars.length && cars.every(predicate), `Catalogue filter failed: ${key}`);
      report.filters[key] = 'PASS';
    }
    const venue = report.cars.find((c) => c.model === 'Venue');
    const blocked = (await api('POST', '/availability/check', { carId: venue.id, pickupDateTime: '2026-09-21T10:00:00+05:30', returnDateTime: '2026-09-22T10:00:00+05:30' })).data;
    assert.equal(blocked.available, false);
    report.venueBlock = 'PASS';
    report.admin = { list: 'PASS', detail: 'PASS', pricing: 'PASS', images: 'PASS', features: 'PASS', availability: 'PASS' };
    for (const car of report.cars) for (const image of car.images) {
      const response = await fetch(new URL(image.imageUrl, origin), { redirect: 'error' });
      assert(response.ok && response.headers.get('content-type').includes('image/png'));
      assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
    const output = path.join(__dirname, 'uat-fleet-result.json');
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    log({ apiReady: true, browserVerificationRequired: true, cars: report.cars.length, catalogue: report.catalogueCount, availability: report.availabilityCount, trustedQuotes: report.quotes.length, counts, report: output });
  } catch (error) {
    // Successful car/pricing/features are retained for resumption; only this attempt's uploaded media is rolled back.
    for (const image of uploadedThisRun.reverse()) {
      try { await api('DELETE', `/fleet/${image.carId}/images/${image.id}`); }
      catch { log({ cleanupRequired: true, carId: image.carId, imageId: image.id }); }
    }
    throw error;
  } finally {
    if (token) { try { await api('POST', '/auth/logout'); } catch { log({ verificationLogout: 'FAILED' }); } }
    await prisma.$disconnect();
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}
main().catch((error) => {
  // No raw Prisma/HTTP error objects, credentials, JWTs, or quote tokens.
  process.stderr.write(`UAT seed stopped: ${error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : /^(GET|POST|PATCH|DELETE) /.test(error.message) ? error.message : 'Local fixture operation failed; inspect configuration and rerun.'}\n`);
  if (error.code === 'ERR_ASSERTION') process.stderr.write(`Check location: ${error.stack?.match(/seed-uat-fleet\.js:\d+:\d+/)?.[0] || 'unknown'}\n`);
  process.exitCode = 1;
});
