'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

describe('Customer refund read API', () => {
  let app; let owner; let other; let refund;
  beforeAll(() => { app = createApp(); });
  beforeEach(async () => {
    resetStore(); owner = await seedUser({ email: `refund-owner-${Math.random()}@example.test` }); other = await seedUser({ email: `refund-other-${Math.random()}@example.test` });
    const booking = await prisma.booking.create({ data: { bookingNumber: `RR-${Math.random()}`, userId: owner.id, vendorId: 'vendor', carId: 'car', startAt: new Date(), endAt: new Date(Date.now() + 3600000), subtotal: 25, totalAmount: 25, currencyCode: 'INR', status: 'CANCELLED', paymentStatus: 'refunded' } });
    const payment = await prisma.payment.create({ data: { bookingId: booking.id, userId: owner.id, amount: 25, currencyCode: 'INR', provider: 'razorpay', providerOrderId: `order_${booking.id}`, providerPaymentId: 'pay_read', status: 'refunded' } });
    refund = await prisma.refund.create({ data: { bookingId: booking.id, paymentId: payment.id, amount: 25, currencyCode: 'INR', provider: 'razorpay', providerReference: 'rfnd_read', idempotencyKey: `refund_key_${booking.id.replace(/-/g, '')}`, status: 'succeeded', processedAt: new Date() } });
  });
  const get = (token, id = refund.id) => request(app).get(`/api/v1/refunds/${id}`).set('Authorization', `Bearer ${token}`);

  it('requires authentication and returns only the owning customer safe DTO', async () => {
    expect((await request(app).get(`/api/v1/refunds/${refund.id}`)).status).toBe(401);
    const response = await get(signAccessToken({ sub: owner.id, type: 'access' }));
    expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ id: refund.id, bookingId: refund.bookingId, status: 'succeeded', providerReference: 'rfnd_read' });
    expect(response.body.data).not.toHaveProperty('idempotencyKey');
  });

  it('returns 404 for another customer, unknown refunds, and malformed identifiers', async () => {
    expect((await get(signAccessToken({ sub: other.id, type: 'access' }))).status).toBe(404);
    expect((await get(signAccessToken({ sub: owner.id, type: 'access' }), '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await get(signAccessToken({ sub: owner.id, type: 'access' }), 'not-a-uuid')).status).toBe(422);
  });

  it('lists only the owning booking refunds, including an empty owned booking', async () => {
    const token = signAccessToken({ sub: owner.id, type: 'access' });
    expect((await request(app).get(`/api/v1/bookings/${refund.bookingId}/refunds`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(1);
    const otherBooking = await prisma.booking.create({ data: { bookingNumber: `RR-empty-${Math.random()}`, userId: other.id, vendorId: 'vendor', carId: 'car', startAt: new Date(), endAt: new Date(Date.now() + 3600000), subtotal: 1, totalAmount: 1, currencyCode: 'INR', status: 'CANCELLED', paymentStatus: 'pending' } });
    expect((await request(app).get(`/api/v1/bookings/${otherBooking.id}/refunds`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    const ownEmpty = await prisma.booking.create({ data: { bookingNumber: `RR-own-empty-${Math.random()}`, userId: owner.id, vendorId: 'vendor', carId: 'car', startAt: new Date(), endAt: new Date(Date.now() + 3600000), subtotal: 1, totalAmount: 1, currencyCode: 'INR', status: 'CANCELLED', paymentStatus: 'pending' } });
    expect((await request(app).get(`/api/v1/bookings/${ownEmpty.id}/refunds`).set('Authorization', `Bearer ${token}`)).body.data).toEqual([]);
  });
});
