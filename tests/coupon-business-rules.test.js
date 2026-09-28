'use strict';

jest.mock('../src/modules/coupons/repository', () => ({
  CouponRepository: {
    findByCode: jest.fn(),
    usageCount: jest.fn(),
    userUsageCount: jest.fn(),
  },
}));

const {
  CouponRepository,
} = require('../src/modules/coupons/repository');

const {
  calculateDiscount,
  validateCouponForUser,
} = require('../src/modules/coupons/service');

function coupon(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'SAVE10',
    discountType: 'percentage',
    discountValue: 10,
    minimumBookingAmount: null,
    maximumDiscount: null,
    startDate: null,
    endDate: null,
    usageLimit: null,
    perUserLimit: 1,
    status: 'active',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Coupon business rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    CouponRepository.usageCount.mockResolvedValue(0);
    CouponRepository.userUsageCount.mockResolvedValue(0);
  });

  test('calculates percentage discount', () => {
    expect(
      calculateDiscount(coupon(), 2500),
    ).toBe(250);
  });

  test('calculates fixed discount', () => {
    expect(
      calculateDiscount(
        coupon({
          discountType: 'fixed',
          discountValue: 500,
        }),
        2500,
      ),
    ).toBe(500);
  });

  test('applies maximum discount cap', () => {
    expect(
      calculateDiscount(
        coupon({
          discountValue: 50,
          maximumDiscount: 300,
        }),
        2000,
      ),
    ).toBe(300);
  });

  test('never discounts below zero payable amount', () => {
    expect(
      calculateDiscount(
        coupon({
          discountType: 'fixed',
          discountValue: 5000,
        }),
        1000,
      ),
    ).toBe(1000);
  });

  test('valid coupon returns authoritative discount preview', async () => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon(),
    );

    const result = await validateCouponForUser({
      code: 'save10',
      bookingAmount: 2000,
      userId: 'user-1',
    });

    expect(
      CouponRepository.findByCode,
    ).toHaveBeenCalledWith(
      'SAVE10',
      expect.anything(),
    );

    expect(result.discountAmount).toBe(200);
    expect(result.discountedAmount).toBe(1800);
    expect(result.coupon.code).toBe('SAVE10');
  });

  test('rejects unknown coupon', async () => {
    CouponRepository.findByCode.mockResolvedValue(null);

    await expect(
      validateCouponForUser({
        code: 'INVALID',
        bookingAmount: 2000,
        userId: 'user-1',
      }),
    ).rejects.toThrow('Invalid coupon code.');
  });

  test.each([
    'inactive',
    'expired',
    'disabled',
  ])('rejects %s coupon status', async (status) => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon({ status }),
    );

    await expect(
      validateCouponForUser({
        code: 'SAVE10',
        bookingAmount: 2000,
        userId: 'user-1',
      }),
    ).rejects.toThrow('Coupon is not active.');
  });

  test('rejects coupon before start date', async () => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon({
        startDate: new Date(Date.now() + 86400000),
      }),
    );

    await expect(
      validateCouponForUser({
        code: 'SAVE10',
        bookingAmount: 2000,
        userId: 'user-1',
      }),
    ).rejects.toThrow('Coupon is not active yet.');
  });

  test('rejects coupon after end date', async () => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon({
        endDate: new Date(Date.now() - 86400000),
      }),
    );

    await expect(
      validateCouponForUser({
        code: 'SAVE10',
        bookingAmount: 2000,
        userId: 'user-1',
      }),
    ).rejects.toThrow('Coupon has expired.');
  });

  test('rejects booking below minimum amount', async () => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon({
        minimumBookingAmount: 5000,
      }),
    );

    await expect(
      validateCouponForUser({
        code: 'SAVE10',
        bookingAmount: 4999,
        userId: 'user-1',
      }),
    ).rejects.toThrow(
      'Minimum booking amount for this coupon is 5000.',
    );
  });

  test('rejects exhausted global usage limit', async () => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon({
        usageLimit: 100,
      }),
    );

    CouponRepository.usageCount.mockResolvedValue(100);

    await expect(
      validateCouponForUser({
        code: 'SAVE10',
        bookingAmount: 2000,
        userId: 'user-1',
      }),
    ).rejects.toThrow(
      'Coupon usage limit has been reached.',
    );
  });

  test('rejects exhausted per-user limit', async () => {
    CouponRepository.findByCode.mockResolvedValue(
      coupon({
        perUserLimit: 2,
      }),
    );

    CouponRepository.userUsageCount.mockResolvedValue(2);

    await expect(
      validateCouponForUser({
        code: 'SAVE10',
        bookingAmount: 2000,
        userId: 'user-1',
      }),
    ).rejects.toThrow(
      'You have already used this coupon the maximum number of times.',
    );
  });
});
