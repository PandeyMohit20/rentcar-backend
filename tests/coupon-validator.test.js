'use strict';

const schemas = require('../src/modules/coupons/validator');

describe('Coupon validation schemas', () => {
  test('normalizes coupon code to uppercase', () => {
    const result = schemas.create.parse({
      code: 'save-20',
      discountType: 'percentage',
      discountValue: 20,
    });

    expect(result.code).toBe('SAVE-20');
  });

  test('rejects percentage above 100', () => {
    expect(() =>
      schemas.create.parse({
        code: 'BAD',
        discountType: 'percentage',
        discountValue: 101,
      }),
    ).toThrow();
  });

  test('allows fixed discount above 100', () => {
    const result = schemas.create.parse({
      code: 'FLAT500',
      discountType: 'fixed',
      discountValue: 500,
    });

    expect(result.discountValue).toBe(500);
  });

  test('rejects end date before start date', () => {
    expect(() =>
      schemas.create.parse({
        code: 'DATES',
        discountType: 'fixed',
        discountValue: 100,
        startDate: '2026-10-10T00:00:00.000Z',
        endDate: '2026-10-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  test('rejects invalid coupon code characters', () => {
    expect(() =>
      schemas.create.parse({
        code: 'SAVE 20%',
        discountType: 'percentage',
        discountValue: 20,
      }),
    ).toThrow();
  });

  test('rejects zero usage limit', () => {
    expect(() =>
      schemas.create.parse({
        code: 'LIMIT',
        discountType: 'fixed',
        discountValue: 100,
        usageLimit: 0,
      }),
    ).toThrow();
  });

  test('rejects zero per-user limit', () => {
    expect(() =>
      schemas.create.parse({
        code: 'USERLIMIT',
        discountType: 'fixed',
        discountValue: 100,
        perUserLimit: 0,
      }),
    ).toThrow();
  });

  test('update rejects percentage above 100 when type supplied', () => {
    expect(() =>
      schemas.update.parse({
        discountType: 'percentage',
        discountValue: 150,
      }),
    ).toThrow();
  });
});
