'use strict';

const request = require('supertest');

const { createApp } = require('../src/app');
const {
  prisma,
  resetStore,
  seedUser,
} = require('./helpers/auth');
const {
  signAccessToken,
} = require('../src/utils/jwt');
const {
  verifyQuote,
} = require('../src/modules/pricing/service');

describe('Trusted coupon pricing quote', () => {
  let app;
  let car;
  let accessToken;

  const pickup =
    '2026-10-10T10:00:00+05:30';

  const dropoff =
    '2026-10-11T10:00:00+05:30';

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();

    const user = await seedUser({
      email: 'coupon-quote@example.com',
    });

    accessToken = signAccessToken({
      sub: user.id,
      type: 'access',
    });

    car = await prisma.car.create({
      data: {
        vendorId: 'v',
        branchId: 'b',
        registrationNumber:
          `COUPON-${Math.random()}`,
        brand: 'Toyota',
        model: 'Camry',
        manufacturingYear: 2025,
        status: 'available',
        isDeleted: false,
      },
    });

    await prisma.carPricing.create({
      data: {
        carId: car.id,
        dailyPrice: 1000,
        securityDeposit: 500,
        currencyCode: 'INR',
        status: 'active',
      },
    });
  });

  async function createCoupon(data = {}) {
    return prisma.coupon.create({
      data: {
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        status: 'active',
        ...data,
      },
    });
  }

  function quote(body = {}, authenticated = true) {
    let req = request(app)
      .post('/api/v1/pricing/quote');

    if (authenticated) {
      req = req.set(
        'Authorization',
        `Bearer ${accessToken}`,
      );
    }

    return req.send({
      carId: car.id,
      pickupDateTime: pickup,
      returnDateTime: dropoff,
      ...body,
    });
  }

  it('preserves non-coupon quote behavior', async () => {
    const response = await quote();

    expect(response.status).toBe(201);

    expect(response.body.data.pricing)
      .toMatchObject({
        originalRentalSubtotal: 1000,
        discount: 0,
        rentalSubtotal: 1000,
        securityDeposit: 500,
        payableAmount: 1500,
      });

    expect(response.body.data)
      .not.toHaveProperty('coupon');

    const signed = verifyQuote(
      response.body.data.quoteToken,
    );

    expect(signed.originalRentalSubtotal)
      .toBe(1000);
    expect(signed.discount).toBe(0);
    expect(signed.rentalSubtotal).toBe(1000);
    expect(signed).not.toHaveProperty('coupon');
  });

  it('applies percentage coupon before tax and signs coupon snapshot', async () => {
    const coupon = await createCoupon();

    const response = await quote({
      couponCode: 'save10',
    });

    expect(response.status).toBe(201);

    expect(response.body.data.pricing)
      .toMatchObject({
        originalRentalSubtotal: 1000,
        discount: 100,
        rentalSubtotal: 900,
        securityDeposit: 500,
        payableAmount: 1400,
      });

    expect(response.body.data.coupon)
      .toMatchObject({
        id: coupon.id,
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        discountAmount: 100,
      });

    expect(
      response.body.data
        .financialSnapshot.rentalSubtotal,
    ).toBe(900);

    expect(
      response.body.data
        .financialSnapshot.securityDeposit,
    ).toBe(500);

    const signed = verifyQuote(
      response.body.data.quoteToken,
    );

    expect(signed).toMatchObject({
      originalRentalSubtotal: 1000,
      discount: 100,
      rentalSubtotal: 900,
      securityDeposit: 500,
      payableAmount: 1400,
    });

    expect(signed.coupon).toMatchObject({
      id: coupon.id,
      code: 'SAVE10',
      discountAmount: 100,
    });
  });

  it('applies fixed coupon without discounting security deposit', async () => {
    await createCoupon({
      code: 'FLAT250',
      discountType: 'fixed',
      discountValue: 250,
    });

    const response = await quote({
      couponCode: 'flat250',
    });

    expect(response.status).toBe(201);

    expect(response.body.data.pricing)
      .toMatchObject({
        originalRentalSubtotal: 1000,
        discount: 250,
        rentalSubtotal: 750,
        securityDeposit: 500,
        payableAmount: 1250,
      });
  });

  it('honours percentage maximum discount cap', async () => {
    await createCoupon({
      code: 'HALF',
      discountType: 'percentage',
      discountValue: 50,
      maximumDiscount: 200,
    });

    const response = await quote({
      couponCode: 'HALF',
    });

    expect(response.status).toBe(201);

    expect(response.body.data.pricing)
      .toMatchObject({
        originalRentalSubtotal: 1000,
        discount: 200,
        rentalSubtotal: 800,
        securityDeposit: 500,
        payableAmount: 1300,
      });
  });

  it('rejects invalid coupon without issuing discounted quote', async () => {
    const response = await quote({
      couponCode: 'DOESNOTEXIST',
    });

    expect(response.status).toBe(422);
  });

  it('rejects client supplied financial fields', async () => {
    const response = await quote({
      couponCode: undefined,
      discount: 999,
    });

    expect(response.status).toBe(422);
  });
});
