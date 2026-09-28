'use strict';

const { Prisma, PrismaClient, VendorSettlementPayoutAttemptStatusEnum } = require('@prisma/client');
const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'VendorSettlementPayoutAttempt');

describe('M11 payout persistence foundation (no payout behavior)', () => {
  it('exposes the generated delegate and independent attempt enum', () => {
    const client = new PrismaClient(); // Construction does not connect to a database.
    expect(client.vendorSettlementPayoutAttempt.findUnique).toBeInstanceOf(Function);
    expect(Object.values(VendorSettlementPayoutAttemptStatusEnum)).toEqual([
      'prepared', 'dispatching', 'unknown', 'pending', 'succeeded', 'failed',
    ]);
  });

  it('keeps request, destination and exact money evidence required', () => {
    for (const name of ['settlementId', 'attemptNumber', 'idempotencyKeyHash', 'requestHash',
      'provider', 'bankAccountId', 'destinationFingerprint', 'destinationSnapshot', 'amount',
      'currencyCode', 'initiatedBy', 'initiatedAt']) {
      expect(model.fields.find((f) => f.name === name).isRequired).toBe(true);
    }
    expect(model.fields.find((f) => f.name === 'amount').type).toBe('Decimal');
    expect(model.fields.find((f) => f.name === 'destinationSnapshot').type).toBe('Json');
    expect(model.fields.find((f) => f.name === 'providerPayoutId').isRequired).toBe(false);
    expect(model.fields.some((f) => ['idempotencyKey', 'rawResponse', 'providerSecret'].includes(f.name))).toBe(false);
  });

  it('has independent compound uniqueness and restrictive historical relations', () => {
    expect(model.uniqueFields).toEqual(expect.arrayContaining([
      ['settlementId', 'attemptNumber'], ['settlementId', 'idempotencyKeyHash'], ['provider', 'providerPayoutId'],
    ]));
    for (const name of ['settlement', 'bankAccount', 'initiator']) {
      expect(model.fields.find((f) => f.name === name).relationOnDelete).toBe('Restrict');
    }
    for (const [name, inverse] of [['VendorSettlement', 'payoutAttempts'], ['VendorBankAccount', 'payoutAttempts'], ['User', 'settlementPayoutAttempts']]) {
      const parent = Prisma.dmmf.datamodel.models.find((m) => m.name === name);
      expect(parent.fields.find((f) => f.name === inverse).type).toBe(model.name);
    }
  });

  it('preserves generation idempotency independently of attempt idempotency', () => {
    const settlement = Prisma.dmmf.datamodel.models.find((m) => m.name === 'VendorSettlement');
    expect(settlement.uniqueFields).toContainEqual(['vendorId', 'idempotencyKeyHash']);
    expect(settlement.fields.find((f) => f.name === 'requestHash').isRequired).toBe(false);
  });
});
