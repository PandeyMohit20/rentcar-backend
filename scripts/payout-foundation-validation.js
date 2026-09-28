'use strict';

// Schema-only validation. Never write business records to the source database.
require('dotenv').config();
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { settlementFixture } = require('../tests/helpers/settlement');
const migration = '20260928143500_add_vendor_settlement_payout_safety';
const table = 'vendor_settlement_payout_attempts';
const evidencePath = path.join(__dirname, '../docs/m11-validation-evidence.json');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const digest = (value) => hash(JSON.stringify(value));
const sqlPath = path.join(__dirname, '../prisma/migrations', migration, 'migration.sql');
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const models = ['booking', 'payment', 'refund', 'tripHistory', 'vendorSettlement',
  'vendorSettlementItem', 'vendor', 'vendorBankAccount', 'setting'];

async function snapshot(db) {
  const result = {};
  for (const model of models) {
    const rows = await db[model].findMany({ orderBy: { id: 'asc' } });
    result[model] = { count: rows.length, digest: digest(rows) };
  }
  result.bookingStatuses = await db.booking.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
  result.settlementStatuses = await db.vendorSettlement.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
  const id = '61b1f4d0-6d08-4f05-a15d-285e534c50d9';
  const header = await db.vendorSettlement.findUniqueOrThrow({ where: { id } });
  const items = await db.vendorSettlementItem.findMany({ where: { settlementId: id }, orderBy: { id: 'asc' } });
  assert.equal(header.status, 'pending');
  assert.equal(String(header.netPayable), '1890');
  for (const field of ['bankAccountId', 'payoutReference', 'processedAt', 'failedAt', 'failureReason']) assert.equal(header[field], null);
  assert.equal(header.requiresFinancialReview, false);
  assert.equal(items.length, 1);
  result.uat = { id, status: header.status, netPayable: String(header.netPayable), bankAccountId: header.bankAccountId,
    payoutReference: header.payoutReference, processedAt: header.processedAt, failedAt: header.failedAt,
    failureReason: header.failureReason, requiresFinancialReview: header.requiresFinancialReview,
    headerDigest: digest(header), itemCount: items.length, itemDigest: digest(items) };
  return result;
}

async function historyCheck(db, deployed) {
  const history = await db.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
  const root = path.join(__dirname, '../prisma/migrations');
  const local = fs.readdirSync(root).filter((name) => fs.existsSync(path.join(root, name, 'migration.sql')));
  const legacy = ['20260808102136_initial_schema', '20260808105511_hardening'];
  for (const row of history) {
    assert(row.finished_at && !row.rolled_back_at, `Unsuccessful history: ${row.migration_name}`);
    assert(local.includes(row.migration_name) || legacy.includes(row.migration_name), 'Unexpected history');
    if (!local.includes(row.migration_name)) continue;
    const bytes = fs.readFileSync(path.join(root, row.migration_name, 'migration.sql'));
    // Known M8/M9 checkout CRLF representation; do not rewrite either file.
    const knownCrLf = ['20260920000100_add_booking_vendor_commission_snapshot', '20260920000200_add_vendor_settlements'].includes(row.migration_name);
    assert(row.checksum === hash(bytes) || (knownCrLf && row.checksum === hash(bytes.toString('utf8').replace(/\r\n/g, '\n'))), `Checksum mismatch: ${row.migration_name}`);
  }
  assert(history.some((h) => h.migration_name === '20260928110920_add_vendor_settlement_generation_safety'));
  assert.deepEqual(local.filter((name) => !history.some((h) => h.migration_name === name)).sort(), deployed ? [] : [migration]);
  return { history, fileHashes: Object.fromEntries(local.map((name) => [name, hash(fs.readFileSync(path.join(root, name, 'migration.sql')))])) };
}

async function schemaEvidence(db) {
  const columns = await db.$queryRaw`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} ORDER BY ORDINAL_POSITION`;
  const indexes = await db.$queryRaw`SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} ORDER BY INDEX_NAME, SEQ_IN_INDEX`;
  const fks = await db.$queryRaw`SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${table} ORDER BY CONSTRAINT_NAME`;
  return JSON.parse(JSON.stringify({ columns, indexes, fks }, (_key, value) => typeof value === 'bigint' ? Number(value) : value));
}

async function validateConstraints(db, fixture, settlement, bank) {
  const make = (overrides = {}) => ({ settlementId: settlement.id, attemptNumber: 1,
    idempotencyKeyHash: hash('isolated-only-key'), requestHash: hash('isolated-only-request'),
    provider: 'isolated-fake', bankAccountId: bank.id, destinationFingerprint: hash('isolated-only-destination'),
    destinationSnapshot: { version: 1, testOnly: true }, amount: '1890.01', currencyCode: 'INR', initiatedBy: fixture.user.id,
    ...overrides });
  const attempts = db.vendorSettlementPayoutAttempt;
  const first = await attempts.create({ data: make() });
  const second = await attempts.create({ data: make({ attemptNumber: 2, idempotencyKeyHash: hash('second') }) });
  assert.equal(first.providerPayoutId, null);
  assert.equal(second.providerPayoutId, null);
  assert.equal(first.status, 'prepared');
  assert.equal(String(first.amount), '1890.01');
  assert.deepEqual(first.destinationSnapshot, { version: 1, testOnly: true });
  await assert.rejects(attempts.create({ data: make({ idempotencyKeyHash: hash('third') }) }), { code: 'P2002' });
  await assert.rejects(attempts.create({ data: make({ attemptNumber: 3 }) }), { code: 'P2002' });
  await attempts.update({ where: { id: first.id }, data: { providerPayoutId: 'isolated-fixture-reference' } });
  await assert.rejects(attempts.update({ where: { id: second.id }, data: { providerPayoutId: 'isolated-fixture-reference' } }), { code: 'P2002' });
  await attempts.update({ where: { id: second.id }, data: { provider: 'other-isolated-fake', providerPayoutId: 'isolated-fixture-reference' } });
  const other = await db.vendorSettlement.create({ data: { settlementNumber: `M11-${crypto.randomUUID()}`, vendorId: fixture.vendor.id,
    periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-02') } });
  await attempts.create({ data: make({ settlementId: other.id }) });
  await assert.rejects(db.vendorSettlement.delete({ where: { id: other.id } }), { code: 'P2003' });
  await assert.rejects(db.vendorBankAccount.delete({ where: { id: bank.id } }), { code: 'P2003' });
  const actor = await db.user.create({ data: { name: 'M11 actor', email: `${crypto.randomUUID()}@example.test`, passwordHash: 'isolated-only' } });
  await attempts.update({ where: { id: second.id }, data: { initiatedBy: actor.id } });
  await assert.rejects(db.user.delete({ where: { id: actor.id } }), { code: 'P2003' });
  const linked = await attempts.findUniqueOrThrow({ where: { settlementId_attemptNumber: { settlementId: settlement.id, attemptNumber: 1 } }, include: { settlement: true, bankAccount: true, initiator: true } });
  assert.equal(linked.settlement.id, settlement.id);
  assert.equal(linked.bankAccount.id, bank.id);
  assert.equal(linked.initiator.id, fixture.user.id);
  assert(await attempts.findUnique({ where: { settlementId_idempotencyKeyHash: { settlementId: settlement.id, idempotencyKeyHash: first.idempotencyKeyHash } } }));
  assert(await attempts.findUnique({ where: { provider_providerPayoutId: { provider: first.provider, providerPayoutId: 'isolated-fixture-reference' } } }));
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname, '/rentcar');
  assert.equal(hash(process.env.DATABASE_URL), 'ad2808693cf36c26c19569b163772b5266a1095600b22416b9b27aa3ba134803');
  const source = new PrismaClient({ log: [] });
  let isolated, name, created = false, passed = false;
  try {
    const mode = process.argv[2];
    assert(['validate', 'predeploy', 'verify'].includes(mode), 'Use validate, predeploy or verify');
    const currentHistory = await historyCheck(source, mode === 'verify');
    const before = await snapshot(source);
    if (mode !== 'validate') {
      const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      assert.deepEqual(before, evidence.before, 'Business digest changed: STOP');
      assert.deepEqual(currentHistory.fileHashes, evidence.migrations.fileHashes, 'Migration bytes changed: STOP');
      const originalHistory = currentHistory.history.filter((row) => row.migration_name !== migration);
      assert.deepEqual(JSON.parse(JSON.stringify(originalHistory)), evidence.migrations.history, 'Historical migration rows changed');
      if (mode === 'verify') {
        assert.equal(await source.vendorSettlementPayoutAttempt.count(), 0);
        assert.deepEqual(await schemaEvidence(source), evidence.expectedSchema);
        evidence.postdeploy = { verifiedAt: new Date().toISOString(), unchanged: true, attempts: 0, migrationChecksum: hash(fs.readFileSync(sqlPath)) };
        fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      }
      output({ mode, passed: true, unchanged: true, before });
      return;
    }
    const tables = await source.$queryRaw`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`;
    assert(!tables.some((row) => row.TABLE_NAME === table));
    name = `rentcar_m11_test_${crypto.randomBytes(6).toString('hex')}`;
    assert(/^rentcar_m11_test_[a-f0-9]{12}$/.test(name));
    await source.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    url.pathname = `/${name}`;
    isolated = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
    assert.equal((await isolated.$queryRawUnsafe('SELECT DATABASE() AS db'))[0].db, name);
    const constraints = [];
    for (const { TABLE_NAME: tableName } of tables) {
      if (tableName === '_prisma_migrations') continue;
      assert(/^[a-z0-9_]+$/.test(tableName));
      const ddl = Object.values((await source.$queryRawUnsafe(`SHOW CREATE TABLE \`${tableName}\``))[0])[1];
      const lines = ddl.split('\n');
      for (const line of lines.filter((s) => /^\s*CONSTRAINT /.test(s))) constraints.push(`ALTER TABLE \`${tableName}\` ADD ${line.trim().replace(/,$/, '')}`);
      await isolated.$executeRawUnsafe(lines.filter((s) => !/^\s*CONSTRAINT /.test(s)).join('\n').replace(/,\n\)/, '\n)'));
    }
    for (const sql of constraints) await isolated.$executeRawUnsafe(sql);
    const fixture = await settlementFixture(isolated);
    const settlement = await isolated.vendorSettlement.create({ data: { settlementNumber: `M11-${crypto.randomUUID()}`, vendorId: fixture.vendor.id,
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-02'), netPayable: '1890.01' } });
    await isolated.vendorSettlementItem.create({ data: { settlementId: settlement.id, bookingId: fixture.booking.id, paymentId: fixture.payment.id, netAmount: '1890.01' } });
    const historical = async () => digest({ headers: await isolated.vendorSettlement.findMany(), items: await isolated.vendorSettlementItem.findMany() });
    const beforeMigration = await historical();
    const statements = fs.readFileSync(sqlPath, 'utf8').split(';').map((s) => s.trim()).filter(Boolean);
    assert.equal(statements.length, 4);
    for (const sql of statements) await isolated.$executeRawUnsafe(sql);
    assert.equal(await historical(), beforeMigration);
    assert.equal(await isolated.vendorSettlementPayoutAttempt.count(), 0);
    const bank = await isolated.vendorBankAccount.create({ data: { vendorId: fixture.vendor.id, accountHolder: 'Isolated test', bankName: 'Isolated test', accountNumber: 'ISOLATED-NOT-A-REAL-ACCOUNT' } });
    await validateConstraints(isolated, fixture, settlement, bank);
    assert.deepEqual(await snapshot(source), before, 'Imported business digest changed: STOP');
    const expectedSchema = await schemaEvidence(isolated);
    assert.equal(expectedSchema.columns.length, 23);
    assert.equal(expectedSchema.fks.length, 3);
    assert(expectedSchema.fks.every((fk) => fk.DELETE_RULE === 'RESTRICT'));
    fs.writeFileSync(evidencePath, `${JSON.stringify({ migration, validatedAt: new Date().toISOString(), before,
      migrations: currentHistory, expectedSchema, isolatedValidation: 'PASS', disposableDatabase: name, disposal: 'pending' }, null, 2)}\n`);
    passed = true;
  } finally {
    if (isolated) await isolated.$disconnect();
    if (created && passed) {
      assert(/^rentcar_m11_test_[a-f0-9]{12}$/.test(name));
      await source.$executeRawUnsafe(`DROP DATABASE \`${name}\``);
      const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      evidence.disposal = 'dropped';
      fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      output({ isolatedValidation: 'PASS', disposableDatabaseDropped: true, importedBusinessDataUnchanged: true });
    } else if (created) output({ stopped: true, disposableDatabaseRetained: name });
    await source.$disconnect();
  }
}

main().catch((error) => { process.stderr.write(`M11 STOP: ${error.message}\n`); process.exitCode = 1; });
