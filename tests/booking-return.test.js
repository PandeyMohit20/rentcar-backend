'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const {
  prisma,
  resetStore,
  seedRole,
  seedUser,
} = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');
const { returnBooking } = require('../src/modules/bookings/service');

describe('protected booking return', () => {
  let app;
  let member;
  let customer;
  let vendor;
  let booking;
  let car;

  const token = (user) =>
    signAccessToken({
      sub: user.id,
      type: 'access',
    });

  const returnVehicle = (
    user,
    body = {
      endOdometer: 150,
      fuelLevelPercent: 60,
    }
  ) =>
    request(app)
      .post(`/api/v1/bookings/${booking.id}/return`)
      .set('Authorization', `Bearer ${token(user)}`)
      .send(body);

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();

    await seedRole('OPERATOR', {
      permissions: ['bookings.operate'],
    });

    member = await seedUser({
      email: `return-op-${Math.random()}@test`,
      roles: ['OPERATOR'],
    });

    customer = await seedUser({
      email: `return-customer-${Math.random()}@test`,
    });

    vendor = await prisma.vendor.create({
      data: {
        vendorCode: `RETURN-V-${Math.random()}`,
        companyName: 'Return Vendor',
      },
    });

    await prisma.vendorMember.create({
      data: {
        vendorId: vendor.id,
        userId: member.id,
        isOwner: true,
      },
    });

    car = await prisma.car.create({
      data: {
        vendorId: vendor.id,
        branchId: 'branch',
        registrationNumber: `RETURN-${Math.random()}`,
        brand: 'T',
        model: 'X',
        manufacturingYear: 2025,
        status: 'busy',
        odometer: 100,
      },
    });

    booking = await prisma.booking.create({
      data: {
        bookingNumber: `RETURN-${Math.random()}`,
        userId: customer.id,
        vendorId: vendor.id,
        carId: car.id,
        startAt: new Date(),
        endAt: new Date(Date.now() + 3600000),
        subtotal: 1,
        totalAmount: 1,
        currencyCode: 'INR',
        status: 'ACTIVE',
        paymentStatus: 'succeeded',
      },
    });

    await prisma.tripHistory.create({
      data: {
        bookingId: booking.id,
        startTime: new Date(),
        startOdometer: 100,
        startFuel: 75,
        startedBy: member.id,
        pickupNotes: 'ready',
        tripStatus: 'active',
      },
    });
  });

  it('requires bookings.operate and vendor membership, then completes the return atomically', async () => {
    expect(
      (await returnVehicle(customer)).status
    ).toBe(403);

    const outsider = await seedUser({
      email: `return-out-${Math.random()}@test`,
      roles: ['OPERATOR'],
    });

    expect(
      (await returnVehicle(outsider)).status
    ).toBe(404);

    const response = await returnVehicle(member, {
      endOdometer: 160,
      fuelLevelPercent: 55,
      notes: '  returned clean  ',
    });

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      bookingId: booking.id,
      status: 'COMPLETED',
      carStatus: 'available',
      return: {
        odometer: 160,
        fuelLevelPercent: 55,
        actualDistance: 60,
      },
    });

    const trip = await prisma.tripHistory.findUnique({
      where: {
        bookingId: booking.id,
      },
    });

    expect(trip).toMatchObject({
      endOdometer: 160,
      endFuel: 55,
      completedBy: member.id,
      returnNotes: 'returned clean',
      actualDistance: 60,
      tripStatus: 'archived',
    });

    expect(trip.endTime).toBeTruthy();

    expect(
      (
        await prisma.booking.findUnique({
          where: {
            id: booking.id,
          },
        })
      ).status
    ).toBe('COMPLETED');

    const updatedCar = await prisma.car.findUnique({
      where: {
        id: car.id,
      },
    });

    expect(updatedCar.status).toBe('available');
    expect(updatedCar.odometer).toBe(160);

    expect(
      await prisma.bookingStatusHistory.count({
        where: {
          bookingId: booking.id,
          fromStatus: 'ACTIVE',
          toStatus: 'COMPLETED',
        },
      })
    ).toBe(1);

    expect(
      await prisma.auditLog.count({
        where: {
          action: 'booking.return.completed',
        },
      })
    ).toBe(1);
  });

  it('is durable-idempotent and rejects conflicting retries', async () => {
    const body = {
      endOdometer: 150,
      fuelLevelPercent: 60,
      notes: 'done',
    };

    expect(
      (await returnVehicle(member, body)).status
    ).toBe(200);

    const replay = await returnVehicle(member, body);

    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);

    expect(
      (
        await returnVehicle(member, {
          ...body,
          endOdometer: 151,
        })
      ).status
    ).toBe(409);

    expect(
      await prisma.bookingStatusHistory.count({
        where: {
          bookingId: booking.id,
          toStatus: 'COMPLETED',
        },
      })
    ).toBe(1);

    expect(
      await prisma.auditLog.count({
        where: {
          action: 'booking.return.completed',
        },
      })
    ).toBe(1);
  });

  it('validates odometer, fuel and payment/car preconditions without mutation', async () => {
    expect(
      (
        await returnVehicle(member, {
          endOdometer: 99,
          fuelLevelPercent: 60,
        })
      ).status
    ).toBe(422);

    expect(
      (
        await returnVehicle(member, {
          endOdometer: 150,
          fuelLevelPercent: 101,
        })
      ).status
    ).toBe(422);

    expect(
      (
        await returnVehicle(member, {
          endOdometer: 150.5,
          fuelLevelPercent: 60,
        })
      ).status
    ).toBe(422);

    await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        paymentStatus: 'pending',
      },
    });

    expect(
      (await returnVehicle(member)).status
    ).toBe(409);

    await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        paymentStatus: 'succeeded',
      },
    });

    await prisma.car.update({
      where: {
        id: car.id,
      },
      data: {
        status: 'maintenance',
      },
    });

    expect(
      (await returnVehicle(member)).status
    ).toBe(409);

    expect(
      (
        await prisma.booking.findUnique({
          where: {
            id: booking.id,
          },
        })
      ).status
    ).toBe('ACTIVE');

    expect(
      await prisma.bookingStatusHistory.count({
        where: {
          bookingId: booking.id,
          toStatus: 'COMPLETED',
        },
      })
    ).toBe(0);
  });

  it('rejects an invalid active trip without completing the booking', async () => {
    const trip = await prisma.tripHistory.findUnique({
      where: {
        bookingId: booking.id,
      },
    });

    await prisma.tripHistory.update({
      where: {
        id: trip.id,
      },
      data: {
        tripStatus: 'archived',
      },
    });

    expect(
      (await returnVehicle(member)).status
    ).toBe(409);

    expect(
      (
        await prisma.booking.findUnique({
          where: {
            id: booking.id,
          },
        })
      ).status
    ).toBe('ACTIVE');

    expect(
      (
        await prisma.car.findUnique({
          where: {
            id: car.id,
          },
        })
      ).status
    ).toBe('busy');
  });

  it('rolls all return changes back when its internal service seam throws', async () => {
    await expect(
      returnBooking({
        operatorId: member.id,
        bookingId: booking.id,
        endOdometer: 175,
        fuelLevelPercent: 50,
        testHooks: {
          afterReturnMutation: async () => {
            throw new Error('rollback');
          },
        },
      })
    ).rejects.toThrow('rollback');

    expect(
      (
        await prisma.booking.findUnique({
          where: {
            id: booking.id,
          },
        })
      ).status
    ).toBe('ACTIVE');

    const unchangedCar = await prisma.car.findUnique({
      where: {
        id: car.id,
      },
    });

    expect(unchangedCar.status).toBe('busy');
    expect(unchangedCar.odometer).toBe(100);

    const trip = await prisma.tripHistory.findUnique({
      where: {
        bookingId: booking.id,
      },
    });

    expect(trip.tripStatus).toBe('active');
    expect(trip.endTime == null).toBe(true);
    expect(trip.endOdometer == null).toBe(true);
    expect(trip.completedBy == null).toBe(true);

    expect(
      await prisma.bookingStatusHistory.count({
        where: {
          bookingId: booking.id,
          toStatus: 'COMPLETED',
        },
      })
    ).toBe(0);

    expect(
      await prisma.auditLog.count({
        where: {
          action: 'booking.return.completed',
        },
      })
    ).toBe(0);

    expect(
      (
        await returnVehicle(member, {
          endOdometer: 175,
          fuelLevelPercent: 50,
        })
      ).status
    ).toBe(200);
  });
});