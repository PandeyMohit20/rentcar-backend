'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

describe('customer KYC submission', () => {
  let app; let user; let token;
  beforeAll(() => { app = createApp(); });
  beforeEach(async () => { resetStore(); user = await seedUser({ email: `kyc-submit-${Math.random()}@test` }); token = signAccessToken({ sub: user.id, type: 'access' }); });
  const licence = (expiresAt = new Date('2035-01-01')) => prisma.userDocument.create({ data: { userId: user.id, documentType: 'driving_license', storageKey: 'private.pdf', status: 'pending', expiresAt } });
  it('requires a current pending driving licence and submits idempotently', async () => { expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(422); await licence(); expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(200); const profile = await prisma.profile.findUnique({ where: { userId: user.id } }); expect(profile).toMatchObject({ verificationStatus: 'pending' }); expect(profile.submittedAt).toBeTruthy(); expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(200); expect(await prisma.auditLog.count({ where: { action: 'kyc.customer.submitted' } })).toBe(2); });
  it('rejects expired evidence and keeps reviewer fields out of status', async () => { await licence(new Date('2020-01-01')); expect((await request(app).post('/api/v1/kyc/submit').set('Authorization', `Bearer ${token}`)).status).toBe(422); await prisma.profile.update({ where: { userId: user.id }, data: { verificationStatus: 'rejected', rejectionReason: 'Upload newer licence', verifiedBy: 'staff' } }); const response = await request(app).get('/api/v1/kyc/status').set('Authorization', `Bearer ${token}`); expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ verificationStatus: 'rejected', rejectionReason: 'Upload newer licence' }); expect(response.body.data).not.toHaveProperty('verifiedBy'); });
});
