'use strict';
/* eslint-disable no-console */

// Explicit opt-in. Clone schema only, never copy or mutate imported business rows.
require('dotenv').config();
const assert = require('assert/strict');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { settlementFixture } = require('../tests/helpers/settlement');
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
let source, db, name, created = false;
const originalFetch = global.fetch;
const counts = async (client) => ({ settlements: await client.vendorSettlement.count(), items: await client.vendorSettlementItem.count(), statuses: await client.booking.groupBy({ by: ['status'], _count: { _all: true } }) });

(async () => {
  assert.equal(process.env.SETTLEMENT_MYSQL_TEST, '1', 'Explicit SETTLEMENT_MYSQL_TEST=1 required');
  const raw = process.env.DATABASE_URL, url = new URL(raw);
  assert.equal(url.hostname, 'localhost'); assert.equal(url.pathname, '/rentcar');
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), 'ad2808693cf36c26c19569b163772b5266a1095600b22416b9b27aa3ba134803');
  source = new PrismaClient({ datasources: { db: { url: raw } }, log: [] });
  const before = await counts(source);
  const tables = await source.$queryRawUnsafe('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE=\'BASE TABLE\'');
  const definitions = [];
  for (const row of tables) {
    const table = row.TABLE_NAME;
    assert(/^[a-z0-9_]+$/.test(table));
    if (table === '_prisma_migrations') continue;
    definitions.push({ table, ddl: Object.values((await source.$queryRawUnsafe(`SHOW CREATE TABLE \`${table}\``))[0])[1] });
  }
  name = `rentcar_settlement_test_${crypto.randomBytes(6).toString('hex')}`;
  await source.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString(); process.env.TEST_DATABASE_MOCK = 'false';
  process.env.LOG_LEVEL = 'silent';
  db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  assert.equal((await db.$queryRawUnsafe('SELECT DATABASE() AS db'))[0].db, name);
  const constraints = [];
  for (const { table, ddl } of definitions) {
    const lines = ddl.split('\n');
    for (const line of lines.filter((s) => /^\s*CONSTRAINT /.test(s))) constraints.push(`ALTER TABLE \`${table}\` ADD ${line.trim().replace(/,$/, '')}`);
    const plain = lines.filter((s) => !/^\s*CONSTRAINT /.test(s)).join('\n').replace(/,\n\)/, '\n)');
    await db.$executeRawUnsafe(plain);
  }
  for (const sql of constraints) await db.$executeRawUnsafe(sql);
  await db.$disconnect();
  db = require('../src/config/database').prisma;
  const { generateSettlement } = require('../src/modules/vendors/settlementGeneration');
  const { financialTransaction } = require('../src/modules/vendors/settlementFinancialGuard');
  const { reconcile } = require('../src/modules/payments/reconciliation');
  const provider = require('../src/modules/payments/providers/razorpay');
  global.fetch = async () => { throw new Error('Network/provider calls forbidden'); };
  const generate = (f, key) => generateSettlement(f.actor, f.vendor.id, { bookingIds: [f.booking.id], currencyCode: 'INR' }, key);
  const assertOne = async (f) => {
    assert.equal(await db.vendorSettlement.count({ where: { vendorId: f.vendor.id } }), 1);
    assert.equal(await db.vendorSettlementItem.count({ where: { bookingId: f.booking.id } }), 1);
  };
  for (let iteration = 0; iteration < 3; iteration++) {
    let f = await settlementFixture(db);
    const identical = await Promise.all([generate(f, 'same'), generate(f, 'same')]);
    assert.equal(identical[0].settlement.id, identical[1].settlement.id); await assertOne(f);
    assert.equal(await db.auditLog.count({ where: { entityId: identical[0].settlement.id, action: 'vendor.settlement.generate' } }), 1);
    f = await settlementFixture(db);
    const competing = await Promise.allSettled([generate(f, 'one'), generate(f, 'two')]);
    assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1); await assertOne(f);
    assert.equal(competing.find((r) => r.status === 'rejected').reason.code, 'SETTLEMENT_BOOKING_INELIGIBLE');
  }
  console.log('PASS A/B: three rounds each identical-key and different-key races; exactly one ledger association and creation audit');

  async function raceFinancial(kind, generationFirst) {
    const f = await settlementFixture(db);
    if (kind === 'reconciliation') {
      await db.payment.create({ data: { bookingId: f.booking.id, userId: f.user.id, provider: 'razorpay', providerOrderId: `other_${crypto.randomUUID()}`, amount: f.payment.amount, currencyCode: 'INR', status: 'failed' } });
      provider.fetchOrderState = async (id) => ({ order: { id, amount: 5153600, currency: 'INR' }, complete: true, payments: id === f.payment.providerOrderId ? [{ id: f.payment.providerPaymentId, order_id: id }] : [] });
      provider.fetchPaymentState = async (id) => ({ id, order_id: f.payment.providerOrderId, amount: 5153600, currency: 'INR', status: 'captured' });
    }
    const reached = deferred(), release = deferred();
    const originalTransaction = db.$transaction.bind(db);
    let held = false;
    db.$transaction = (work, options) => originalTransaction(async (tx) => {
      const modelName = generationFirst ? 'vendorSettlement' : kind === 'refund' ? 'refund' : 'auditLog';
      const proxy = new Proxy(tx, { get(target, key) {
        if (key !== modelName) return target[key];
        return new Proxy(target[key], { get(model, method) {
          if (method !== 'create') return model[method];
          return async (...args) => {
            const result = await model.create(...args);
            if (!held) { held = true; reached.resolve(); await release.promise; }
            return result;
          };
        } });
      } });
      return work(proxy);
    }, options);
    const financial = () => kind === 'refund'
      ? financialTransaction(db, f.booking.id, 'REFUND_CREATED', (tx) => tx.refund.create({ data: { bookingId: f.booking.id, paymentId: f.payment.id, amount: '1.00', currencyCode: 'INR', status: 'pending' } }))
      : reconcile({ userId: f.user.id, bookingId: f.booking.id });
    try {
      const first = generationFirst ? generate(f, 'race') : financial();
      // Attach handlers immediately, and bound the synchronization wait.
      const firstResult = first.then((value) => ({ value }), (error) => ({ error }));
      let timer;
      await Promise.race([reached.promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Race barrier timeout')), 15000); })]).finally(() => clearTimeout(timer));
      const second = generationFirst ? financial() : generate(f, 'race');
      const secondResult = second.then((value) => ({ value }), (error) => ({ error }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      release.resolve();
      const results = await Promise.all([firstResult, secondResult]);
      assert(!results[0].error, results[0].error?.message);
      if (generationFirst) {
        assert(!results[1].error, results[1].error?.message);
        const header = await db.vendorSettlement.findFirst({ where: { vendorId: f.vendor.id } });
        assert(header.requiresFinancialReview); assert.equal(header.status, 'pending'); assert.equal(String(header.netPayable), '38016');
      } else {
        assert.equal(results[1].error?.code, 'SETTLEMENT_BOOKING_INELIGIBLE');
        assert.equal(await db.vendorSettlement.count({ where: { vendorId: f.vendor.id } }), 0);
      }
      if (kind === 'refund') assert.equal(await db.refund.count({ where: { bookingId: f.booking.id } }), 1);
    } finally { release.resolve(); db.$transaction = originalTransaction; }
  }
  for (const kind of ['refund', 'reconciliation']) for (const first of [true, false]) await raceFinancial(kind, first);
  console.log('PASS C/D: refund and production reconciliation races in both orders; blockers or preserved truth plus review flag');
  assert.deepEqual(await counts(source), before);
  console.log(`PASS imported database unchanged; isolated schema=${name}; no network calls`);
})().catch((err) => { console.error('FAIL', err.name, err.code || '', err.message); process.exitCode = 1; }).finally(async () => {
  global.fetch = originalFetch;
  if (db) await db.$disconnect();
  if (created && /^rentcar_settlement_test_[a-f0-9]{12}$/.test(name)) {
    await source.$executeRawUnsafe(`DROP DATABASE \`${name}\``);
    console.log(`Dropped task-created database ${name}`);
  }
  if (source) await source.$disconnect();
});
