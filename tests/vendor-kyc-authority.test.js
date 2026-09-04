'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedRole, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

describe('vendor KYC authority boundary', () => {
  let app; let updateToken; let reviewToken; let reviewer;
  beforeAll(() => { app = createApp(); });
  beforeEach(async () => {
    resetStore(); await seedRole('VENDOR_WRITE', { permissions: ['vendors.create', 'vendors.update'] }); await seedRole('KYC_REVIEW', { permissions: ['kyc.review'] });
    const writer = await seedUser({ email: `writer-${Math.random()}@test`, roles: ['VENDOR_WRITE'] }); reviewer = await seedUser({ email: `reviewer-${Math.random()}@test`, roles: ['KYC_REVIEW'] });
    updateToken = signAccessToken({ sub: writer.id, type: 'access' }); reviewToken = signAccessToken({ sub: reviewer.id, type: 'access' });
  });
  it('does not let vendor create/update payloads set authoritative review status', async () => {
    const created = await request(app).post('/api/v1/vendors').set('Authorization', `Bearer ${updateToken}`).send({ vendorCode: `V-${Math.random()}`, companyName: 'Authority vendor', verificationStatus: 'verified' });
    expect(created.status).toBe(201); expect(created.body.data.verificationStatus).toBe('pending');
    const updated = await request(app).patch(`/api/v1/vendors/${created.body.data.id}`).set('Authorization', `Bearer ${updateToken}`).send({ verificationStatus: 'rejected' });
    expect(updated.status).toBe(200); expect((await prisma.vendor.findUnique({ where: { id: created.body.data.id } })).verificationStatus).toBe('pending');
    await prisma.vendorDocument.create({ data: { vendorId: created.body.data.id, documentType: 'gst', documentUrl: 'private/vendors/authority.pdf', status: 'verified' } });
    expect((await request(app).patch(`/api/v1/vendors/${created.body.data.id}/verification-status`).set('Authorization', `Bearer ${updateToken}`).send({ verificationStatus: 'verified' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/vendors/${created.body.data.id}/verification-status`).set('Authorization', `Bearer ${reviewToken}`).send({ verificationStatus: 'verified' })).status).toBe(200);
    const ownVendor = await prisma.vendor.create({ data: { vendorCode: `SELF-${Math.random()}`, companyName: 'Reviewer vendor', verificationStatus: 'pending' } });
    await prisma.vendorMember.create({ data: { vendorId: ownVendor.id, userId: reviewer.id, isOwner: true } });
    expect((await request(app).patch(`/api/v1/vendors/${ownVendor.id}/verification-status`).set('Authorization', `Bearer ${reviewToken}`).send({ verificationStatus: 'rejected', reason: 'self review blocked' })).status).toBe(409);
  });
});
