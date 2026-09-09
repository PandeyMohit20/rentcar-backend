'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedRole, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');
const { vendorDocumentDir } = require('../src/middlewares/upload');

const pdf = Buffer.from('%PDF-1.4 vendor');

describe('vendor-member document access and private storage', () => {
  let app; let member; let outsider; let reviewer; let vendor; let token; let outsiderToken; let reviewerToken;
  const clearFiles = () => { if (fs.existsSync(vendorDocumentDir)) fs.readdirSync(vendorDocumentDir).forEach((file) => fs.unlinkSync(path.join(vendorDocumentDir, file))); };
  const upload = (auth = token, fields = {}) => request(app).post(`/api/v1/vendors/${vendor.id}/documents`).set('Authorization', `Bearer ${auth}`).field('documentType', fields.documentType === undefined ? 'gst' : fields.documentType).attach('file', pdf, { filename: fields.filename || 'source.pdf', contentType: fields.mime || 'application/pdf' });

  beforeAll(() => { app = createApp(); });
  beforeEach(async () => {
    resetStore(); clearFiles();
    await seedRole('VENDOR_EDITOR', { permissions: ['vendors.view', 'vendors.update', 'vendors.delete'] });
    await seedRole('VIEW_ONLY', { permissions: ['vendors.view'] });
    await seedRole('REVIEWER', { permissions: ['kyc.review'] });
    member = await seedUser({ email: `member-${Math.random()}@test`, roles: ['VENDOR_EDITOR'] });
    outsider = await seedUser({ email: `outsider-${Math.random()}@test`, roles: ['VENDOR_EDITOR'] });
    reviewer = await seedUser({ email: `reviewer-${Math.random()}@test`, roles: ['REVIEWER'] });
    vendor = await prisma.vendor.create({ data: { vendorCode: `V-${Math.random()}`, companyName: 'Scoped Vendor' } });
    await prisma.vendorMember.create({ data: { vendorId: vendor.id, userId: member.id, isOwner: true } });
    token = signAccessToken({ sub: member.id, type: 'access' }); outsiderToken = signAccessToken({ sub: outsider.id, type: 'access' }); reviewerToken = signAccessToken({ sub: reviewer.id, type: 'access' });
  });
  afterEach(clearFiles);

  it('permits a member to manage only their vendor documents without leaking storage references', async () => {
    const created = await upload();
    expect(created.status).toBe(201); expect(created.body.data).not.toHaveProperty('documentUrl');
    const document = await prisma.vendorDocument.findUnique({ where: { id: created.body.data.id } });
    expect(document.documentUrl).toMatch(/^private\/vendors\/[0-9a-f-]+\.pdf$/);
    expect(fs.existsSync(path.join(vendorDocumentDir, path.basename(document.documentUrl)))).toBe(true);
    expect((await request(app).get(`/api/v1/vendors/${vendor.id}/documents`).set('Authorization', `Bearer ${token}`)).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/v1/vendors/documents/${document.id}`).set('Authorization', `Bearer ${token}`)).body.data).not.toHaveProperty('documentUrl');
    expect((await request(app).get(`/api/v1/vendors/documents/${document.id}/download`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).patch(`/api/v1/vendors/documents/${document.id}`).set('Authorization', `Bearer ${token}`).send({ remarks: 'updated' })).status).toBe(200);
    expect((await request(app).delete(`/api/v1/vendors/documents/${document.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect(fs.existsSync(path.join(vendorDocumentDir, path.basename(document.documentUrl)))).toBe(false);
  });

  it('returns non-disclosing not-found responses for non-members with broad vendor permissions', async () => {
    const document = await prisma.vendorDocument.create({ data: { vendorId: vendor.id, documentType: 'gst', documentUrl: 'private/vendors/missing.pdf', status: 'pending' } });
    for (const response of [
      await request(app).get(`/api/v1/vendors/${vendor.id}/documents`).set('Authorization', `Bearer ${outsiderToken}`),
      await upload(outsiderToken),
      await request(app).get(`/api/v1/vendors/documents/${document.id}`).set('Authorization', `Bearer ${outsiderToken}`),
      await request(app).get(`/api/v1/vendors/documents/${document.id}/download`).set('Authorization', `Bearer ${outsiderToken}`),
      await request(app).patch(`/api/v1/vendors/documents/${document.id}`).set('Authorization', `Bearer ${outsiderToken}`).send({ remarks: 'x' }),
      await request(app).delete(`/api/v1/vendors/documents/${document.id}`).set('Authorization', `Bearer ${outsiderToken}`),
    ]) expect(response.status).toBe(404);
  });

  it('permits kyc reviewers and safely supports legacy references while rejecting unsafe references', async () => {
    const legacyRoot = path.join(require('../src/config/uploads').uploadRoot, 'vendors'); fs.mkdirSync(legacyRoot, { recursive: true });
    fs.writeFileSync(path.join(legacyRoot, 'historic.pdf'), pdf);
    const legacy = await prisma.vendorDocument.create({ data: { vendorId: vendor.id, documentType: 'gst', documentUrl: '/uploads/vendors/historic.pdf', status: 'pending' } });
    expect((await request(app).get(`/api/v1/vendors/${vendor.id}/documents`).set('Authorization', `Bearer ${reviewerToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/vendors/documents/${legacy.id}/download`).set('Authorization', `Bearer ${reviewerToken}`)).status).toBe(200);
    expect((await request(app).get('/uploads/vendors/historic.pdf')).status).not.toBe(200);
    const bad = await prisma.vendorDocument.create({ data: { vendorId: vendor.id, documentType: 'gst', documentUrl: '../../tests/sentinel.pdf', status: 'pending' } });
    expect((await request(app).get(`/api/v1/vendors/documents/${bad.id}/download`).set('Authorization', `Bearer ${reviewerToken}`)).status).toBe(404);
    fs.unlinkSync(path.join(legacyRoot, 'historic.pdf'));
  });

  it('cleans a stored upload after metadata validation or database persistence failure', async () => {
    const invalid = await upload(token, { documentType: '' });
    expect(invalid.status).toBe(422); expect(fs.readdirSync(vendorDocumentDir)).toEqual([]);
    const originalCreate = prisma.vendorDocument.create;
    prisma.vendorDocument.create = async () => { throw new Error('database failed'); };
    const failed = await upload();
    prisma.vendorDocument.create = originalCreate;
    expect(failed.status).toBe(500); expect(fs.readdirSync(vendorDocumentDir)).toEqual([]);
  });
});
