'use strict';

const {
  calculateDiscount,
} = require('../src/modules/coupons/service');

function coupon(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'PRECISION',
    discountType: 'percentage',
    discountValue: 10,
    minimumBookingAmount: null,
    maximumDiscount: null,
    usageLimit: null,
    perUserLimit: 1,
    status: 'active',
    isDeleted: false,
    ...overrides,
  };
}

describe('Coupon exact money precision', () => {
  test('rounds percentage discount to nearest paise', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 10,
        }),
        999.99,
      ),
    ).toBe(100);
  });

  test('handles ten paise percentage boundary exactly', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 10,
        }),
        0.10,
      ),
    ).toBe(0.01);
  });

  test('does not invent a paise below rounding threshold', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 10,
        }),
        0.01,
      ),
    ).toBe(0);
  });

  test('handles decimal percentage using exact basis points', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 10.25,
        }),
        999.99,
      ),
    ).toBe(102.5);
  });

  test('handles one-paise fixed discount exactly', () => {
    expect(
      calculateDiscount(
        coupon({
          discountType: 'fixed',
          discountValue: 0.01,
        }),
        999.99,
      ),
    ).toBe(0.01);
  });

  test('caps fixed discount at booking subtotal', () => {
    expect(
      calculateDiscount(
        coupon({
          discountType: 'fixed',
          discountValue: 1000,
        }),
        999.99,
      ),
    ).toBe(999.99);
  });

  test('handles exact 100 percent discount', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 100,
        }),
        999.99,
      ),
    ).toBe(999.99);
  });

  test('honours decimal maximum discount cap exactly', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 50,
          maximumDiscount: 123.45,
        }),
        999.99,
      ),
    ).toBe(123.45);
  });

  test('rounds half paise upward to nearest paise', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 50,
        }),
        0.01,
      ),
    ).toBe(0.01);
  });

  test('rejects percentage precision beyond two decimals', () => {
    expect(() =>
      calculateDiscount(
        coupon({
          discountValue: '10.001',
        }),
        1000,
      ),
    ).toThrow(
      'Percentage discount must have at most two decimal places.',
    );
  });

  test('rejects percentage above 100 percent', () => {
    expect(() =>
      calculateDiscount(
        coupon({
          discountValue: 100.01,
        }),
        1000,
      ),
    ).toThrow(
      'Percentage discount cannot exceed 100.',
    );
  });

  test('rejects money with more than two decimal places', () => {
    expect(() =>
      calculateDiscount(
        coupon({
          discountType: 'fixed',
          discountValue: '1.001',
        }),
        1000,
      ),
    ).toThrow();
  });
});
