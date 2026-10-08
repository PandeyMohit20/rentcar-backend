'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

describe('customer KYC submission', () => {
  let app; let user; let token;
  beforeAll(() => { app = createApp(); });
  beforeEach(async () => { resetStore(); user = await seedUser({ email: `kyc-submit-${Math.random()}@test` }); await prisma.profile.update({ where: { userId: user.id }, data: { verificationStatus: 'unverified', submittedAt: null, verifiedAt: null, rejectionReason: null } }); token = signAccessToken({ sub: user.id, type: 'access' }); });
  const licence = (status = 'pending', expiresAt = new Date('2035-01-01')) => prisma.userDocument.create({ data: { userId: user.id, documentType: 'driving_license', storageKey: 'private.pdf', status, expiresAt, ...(status === 'verified' ? { verifiedAt: new Date() } : {}) } });
  it('requires a current pending driving licence and submits idempotently', async () => { expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(422); await licence(); expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(200); const profile = await prisma.profile.findUnique({ where: { userId: user.id } }); expect(profile).toMatchObject({ verificationStatus: 'pending' }); expect(profile.submittedAt).toBeTruthy(); expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(200); expect(await prisma.auditLog.count({ where: { action: 'kyc.customer.submitted' } })).toBe(2); });
  it('accepts a verified current licence for submission but still requires admin approval', async () => {
    await licence('verified');
    const submitted = await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.verificationStatus).toBe('pending');

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile.verificationStatus).toBe('pending');
    expect(profile.submittedAt.toISOString()).toBe(submitted.body.data.submittedAt);
    expect(profile.verifiedAt).toBeNull();

    const status = await request(app).get('/api/v1/kyc/status').set('Authorization', `Bearer ${token}`);
    const authMe = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    const usersMe = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
    expect(status.body.data).toMatchObject({ verificationStatus: 'pending', submittedAt: expect.any(String), verifiedAt: null, documentCount: 1 });
    expect(authMe.body.data.user.profile.verificationStatus).toBe('pending');
    expect(usersMe.body.data.user.profile.verificationStatus).toBe('pending');
  });

  it.each([
    ['pending', new Date('2020-01-01')],
    ['verified', new Date('2020-01-01')],
    ['rejected', new Date('2035-01-01')],
  ])('rejects %s licences that are expired or rejected', async (status, expiresAt) => {
    await licence(status, expiresAt);
    const response = await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(422);
    expect((await prisma.profile.findUnique({ where: { userId: user.id } })).verificationStatus).toBe('unverified');
  });

  it('keeps a verified licence submission separate from profile approval', async () => {
    await licence('verified');
    await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`);
    expect((await prisma.profile.findUnique({ where: { userId: user.id } })).verificationStatus).toBe('pending');
    expect(await prisma.auditLog.count({ where: { action: 'kyc.customer.verified' } })).toBe(0);
  });

  it('rejects expired pending evidence and keeps reviewer fields out of status', async () => { await licence('pending', new Date('2020-01-01')); expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(422); await prisma.profile.update({ where: { userId: user.id }, data: { verificationStatus: 'rejected', rejectionReason: 'Upload newer licence', verifiedBy: 'staff' } }); const response = await request(app).get('/api/v1/kyc/status').set('Authorization', `Bearer ${token}`); expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ verificationStatus: 'rejected', rejectionReason: 'Upload newer licence' }); expect(response.body.data).not.toHaveProperty('verifiedBy'); });
});
