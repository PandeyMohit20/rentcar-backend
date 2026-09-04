'use strict';

const fs = require('fs');
const path = require('path');
const { prisma, resetStore } = require('./helpers/auth');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260904000000_add_trip_operational_operators_and_notes',
  'migration.sql',
);

function model(source, name) {
  const match = source.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm'));
  if (!match) throw new Error(`Missing ${name} model`);
  return match[1];
}

describe('Booking operations schema foundation', () => {
  let schema;

  beforeAll(() => {
    schema = fs.readFileSync(schemaPath, 'utf8');
  });

  beforeEach(() => resetStore());

  it('keeps TripHistory as the one-trip-per-booking operational aggregate', () => {
    const trip = model(schema, 'TripHistory');
    expect(trip).toContain('bookingId      String     @map("booking_id") @db.VarChar(36)');
    expect(trip).toContain('@@unique([bookingId])');
    expect(schema).not.toMatch(/model\s+(?:BookingOperation|TripOperation|Pickup|Return)\s*\{/);
  });

  it('adds only nullable, bounded pickup and return attribution fields', () => {
    const trip = model(schema, 'TripHistory');
    expect(trip).toContain('startedBy      String?    @map("started_by") @db.VarChar(36)');
    expect(trip).toContain('completedBy    String?    @map("completed_by") @db.VarChar(36)');
    expect(trip).toContain('pickupNotes    String?    @map("pickup_notes") @db.VarChar(1000)');
    expect(trip).toContain('returnNotes    String?    @map("return_notes") @db.VarChar(1000)');
  });

  it('uses explicit SetNull User relations and matching inverse relations', () => {
    const user = model(schema, 'User');
    const trip = model(schema, 'TripHistory');
    expect(trip).toContain('startedByUser   User?        @relation("TripStartedBy", fields: [startedBy], references: [id], onDelete: SetNull)');
    expect(trip).toContain('completedByUser User?        @relation("TripCompletedBy", fields: [completedBy], references: [id], onDelete: SetNull)');
    expect(user).toContain('tripsStarted            TripHistory[]    @relation("TripStartedBy")');
    expect(user).toContain('tripsCompleted          TripHistory[]    @relation("TripCompletedBy")');
    expect(user).toContain('id              String         @id @default(uuid()) @db.VarChar(36)');
  });

  it('leaves Booking and existing trip facts, evidence, damage, and extension shapes unchanged', () => {
    const booking = model(schema, 'Booking');
    const trip = model(schema, 'TripHistory');
    const photo = model(schema, 'TripPhoto');
    const damage = model(schema, 'TripDamage');
    const extension = model(schema, 'TripExtension');
    for (const forbidden of ['actualPickupAt', 'actualReturnAt', 'pickupOdometer', 'returnOdometer', 'pickupFuel', 'returnFuel', 'startedBy', 'completedBy']) {
      expect(booking).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
    for (const fact of ['startTime', 'endTime', 'startOdometer', 'endOdometer', 'startFuel', 'endFuel', 'distance', 'actualDistance', 'tripStatus']) {
      expect(trip).toMatch(new RegExp(`\\b${fact}\\b`));
    }
    expect(photo).toContain('imageUrl   String   @map("image_url") @db.VarChar(500)');
    expect(damage).toContain('photoUrl     String?    @map("photo_url") @db.VarChar(500)');
    expect(extension).toContain('additionalAmount Decimal    @default(0) @map("additional_amount") @db.Decimal(12, 2)');
  });

  it('keeps the mock structural for nullable and populated TripHistory operational fields', async () => {
    const legacy = await prisma.tripHistory.create({ data: { bookingId: 'legacy-booking' } });
    expect(legacy.startedBy).toBeUndefined();
    expect(legacy.completedBy).toBeUndefined();
    const attributed = await prisma.tripHistory.create({
      data: { bookingId: 'new-booking', startedBy: 'operator-a', completedBy: 'operator-b', pickupNotes: 'Collected', returnNotes: 'Returned' },
    });
    expect(attributed).toMatchObject({ startedBy: 'operator-a', completedBy: 'operator-b', pickupNotes: 'Collected', returnNotes: 'Returned' });
  });

  it('has an additive migration containing only the four columns and two SetNull foreign keys', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    for (const column of ['started_by', 'completed_by', 'pickup_notes', 'return_notes']) expect(sql).toContain(`\`${column}\``);
    expect(sql).toContain('trip_history_started_by_fkey');
    expect(sql).toContain('trip_history_completed_by_fkey');
    expect(sql).toMatch(/ON DELETE SET NULL/g);
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|RENAME)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/ALTER TABLE `(?!trip_history`)/);
  });
});
