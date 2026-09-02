'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma, resetStore, seedRole, seedUser } = require('./helpers/auth');
const { signAccessToken } = require('../src/utils/jwt');

const fixture = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const uploads = path.join(process.cwd(), 'uploads', 'cars');
const sentinel = path.join(process.cwd(), 'tests', '.car-image-sentinel.txt');

describe('Fleet car images and features', () => {
  let app;
  let viewerToken;
  let editorToken;
  let car;

  beforeAll(() => { app = createApp(); });
  beforeEach(async () => {
    resetStore();
    await seedRole('VIEWER', { permissions: ['fleet.view'] });
    await seedRole('EDITOR', { permissions: ['fleet.view', 'fleet.update'] });
    const viewer = await seedUser({ email: 'viewer@example.com', roles: ['VIEWER'] });
    const editor = await seedUser({ email: 'editor@example.com', roles: ['EDITOR'] });
    viewerToken = signAccessToken({ sub: viewer.id, sessionId: null, type: 'access' });
    editorToken = signAccessToken({ sub: editor.id, sessionId: null, type: 'access' });
    car = await prisma.car.create({ data: { vendorId: 'vendor', branchId: 'branch', registrationNumber: 'TEST-1', brand: 'Test', model: 'Car', manufacturingYear: 2024, status: 'available', isDeleted: false } });
  });
  afterEach(() => { if (fs.existsSync(uploads)) fs.readdirSync(uploads).forEach((file) => fs.unlinkSync(path.join(uploads, file))); });

  const image = (token, carId = car.id, name = 'photo.jpg', type = 'image/jpeg') => request(app).post(`/api/v1/fleet/${carId}/images`).set('Authorization', `Bearer ${token}`).attach('file', fixture, { filename: name, contentType: type });

  it('protects image list and returns an empty authorized list', async () => {
    expect((await request(app).get(`/api/v1/fleet/${car.id}/images`)).status).toBe(401);
    const response = await request(app).get(`/api/v1/fleet/${car.id}/images`).set('Authorization', `Bearer ${viewerToken}`);
    expect(response.status).toBe(200); expect(response.body.data).toEqual([]);
  });

  it('uploads valid images, exposes public URLs, and makes the first one primary', async () => {
    const response = await image(editorToken);
    expect(response.status).toBe(201); expect(response.body.data.isPrimary).toBe(true);
    expect(response.body.data.imageUrl).toMatch(/^\/uploads\/cars\//);
    expect(response.body.data.imageUrl).not.toMatch(/Users|C:/);
    expect(fs.existsSync(path.join(uploads, path.basename(response.body.data.imageUrl)))).toBe(true);
    expect((await request(app).get(response.body.data.imageUrl)).status).toBe(200);
  });

  it('rejects mutations without fleet.update and rejects invalid image types', async () => {
    expect((await image(viewerToken)).status).toBe(403);
    expect((await image(editorToken, car.id, 'bad.svg', 'image/svg+xml')).status).toBe(400);
    expect((await request(app).post(`/api/v1/fleet/${car.id}/images`).set('Authorization', `Bearer ${editorToken}`)).status).toBe(400);
  });

  it('switches the primary image transactionally and preserves exactly one primary', async () => {
    const first = (await image(editorToken, car.id, 'one.jpg')).body.data;
    const second = (await image(editorToken, car.id, 'two.png', 'image/png')).body.data;
    const changed = await request(app).patch(`/api/v1/fleet/${car.id}/images/${second.id}/primary`).set('Authorization', `Bearer ${editorToken}`);
    expect(changed.status).toBe(200);
    const images = await prisma.carImage.findMany({ where: { carId: car.id } });
    expect(images.filter((item) => item.isPrimary)).toHaveLength(1);
    expect(images.find((item) => item.id === first.id).isPrimary).toBe(false);
  });

  it('prevents wrong-car image mutation and promotes replacement after primary deletion', async () => {
    const first = (await image(editorToken, car.id, 'one.jpg')).body.data;
    const second = (await image(editorToken, car.id, 'two.webp', 'image/webp')).body.data;
    const other = await prisma.car.create({ data: { vendorId: 'vendor', branchId: 'branch', registrationNumber: 'TEST-2', brand: 'Other', model: 'Car', manufacturingYear: 2024, status: 'available', isDeleted: false } });
    expect((await request(app).delete(`/api/v1/fleet/${other.id}/images/${first.id}`).set('Authorization', `Bearer ${editorToken}`)).status).toBe(404);
    expect((await request(app).delete(`/api/v1/fleet/${car.id}/images/${first.id}`).set('Authorization', `Bearer ${editorToken}`)).status).toBe(200);
    expect((await prisma.carImage.findUnique({ where: { id: second.id } })).isPrimary).toBe(true);
  });

  it('implements feature CRUD, validation, permissions, and wrong-car protection', async () => {
    expect((await request(app).get(`/api/v1/fleet/${car.id}/features`)).status).toBe(401);
    expect((await request(app).post(`/api/v1/fleet/${car.id}/features`).set('Authorization', `Bearer ${viewerToken}`).send({ name: 'GPS' })).status).toBe(403);
    expect((await request(app).post(`/api/v1/fleet/${car.id}/features`).set('Authorization', `Bearer ${editorToken}`).send({})).status).toBe(422);
    const created = await request(app).post(`/api/v1/fleet/${car.id}/features`).set('Authorization', `Bearer ${editorToken}`).send({ name: 'GPS', iconKey: 'gps' });
    expect(created.status).toBe(201);
    const updated = await request(app).patch(`/api/v1/fleet/${car.id}/features/${created.body.data.id}`).set('Authorization', `Bearer ${editorToken}`).send({ name: 'Navigation' });
    expect(updated.body.data.name).toBe('Navigation');
    const other = await prisma.car.create({ data: { vendorId: 'vendor', branchId: 'branch', registrationNumber: 'TEST-3', brand: 'Other', model: 'Car', manufacturingYear: 2024, status: 'available', isDeleted: false } });
    expect((await request(app).delete(`/api/v1/fleet/${other.id}/features/${created.body.data.id}`).set('Authorization', `Bearer ${editorToken}`)).status).toBe(404);
    expect((await request(app).delete(`/api/v1/fleet/${car.id}/features/${created.body.data.id}`).set('Authorization', `Bearer ${editorToken}`)).status).toBe(200);
  });

  it('returns 403 for image list without fleet.view', async () => { const user=await seedUser({email:'none1@example.com',roles:[]}); const token=signAccessToken({sub:user.id,type:'access'}); expect((await request(app).get(`/api/v1/fleet/${car.id}/images`).set('Authorization',`Bearer ${token}`)).status).toBe(403); });
  it('returns 404 for images of a missing car', async () => { expect((await request(app).get('/api/v1/fleet/00000000-0000-4000-8000-000000000001/images').set('Authorization',`Bearer ${viewerToken}`)).status).toBe(404); });
  it('validates an invalid car UUID for image list', async () => { expect((await request(app).get('/api/v1/fleet/invalid/images').set('Authorization',`Bearer ${viewerToken}`)).status).toBe(422); });
  it('accepts PNG car images', async () => { expect((await image(editorToken,car.id,'photo.png','image/png')).status).toBe(201); });
  it('accepts WEBP car images', async () => { expect((await image(editorToken,car.id,'photo.webp','image/webp')).status).toBe(201); });
  it('deletes the last image without replacement failure', async () => { const item=(await image(editorToken)).body.data; expect((await request(app).delete(`/api/v1/fleet/${car.id}/images/${item.id}`).set('Authorization',`Bearer ${editorToken}`)).status).toBe(200); expect(await prisma.carImage.findMany({where:{carId:car.id}})).toEqual([]); });
  it('returns an empty authorized feature list', async () => { const result=await request(app).get(`/api/v1/fleet/${car.id}/features`).set('Authorization',`Bearer ${viewerToken}`); expect(result.status).toBe(200); expect(result.body.data).toEqual([]); });
  it('returns 404 for features of a missing car', async () => { expect((await request(app).get('/api/v1/fleet/00000000-0000-4000-8000-000000000001/features').set('Authorization',`Bearer ${viewerToken}`)).status).toBe(404); });
  it('validates invalid feature UUID input', async () => { expect((await request(app).patch(`/api/v1/fleet/${car.id}/features/nope`).set('Authorization',`Bearer ${editorToken}`).send({name:'GPS'})).status).toBe(422); });

  it('returns public-safe images and features in the customer car detail DTO', async () => {
    await prisma.carImage.create({ data: { carId: car.id, imageUrl: '/uploads/cars/primary.jpg', isPrimary: true } });
    await prisma.carImage.create({ data: { carId: car.id, imageUrl: '/uploads/cars/second.png', isPrimary: false } });
    await prisma.carFeature.create({ data: { carId: car.id, name: 'GPS', iconKey: 'gps' } });
    await prisma.carFeature.create({ data: { carId: car.id, name: 'Bluetooth', iconKey: 'bluetooth' } });
    const response = await request(app).get(`/api/v1/cars/${car.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.images).toHaveLength(2);
    expect(response.body.data.images[0].imageUrl).toMatch(/^\/uploads\/cars\//);
    expect(JSON.stringify(response.body.data.images)).not.toMatch(/C:|Users|\/home\//);
    expect(response.body.data.features).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'GPS', iconKey: 'gps' })]));
    expect(response.body.data.vendor).toBeNull();
    expect(response.body.data).not.toHaveProperty('documents');
  });

  it('never deletes a sentinel outside the car image directory for persisted traversal URLs', async () => {
    fs.writeFileSync(sentinel, 'protected');
    const malicious = await prisma.carImage.create({ data: { carId: car.id, imageUrl: '/uploads/cars/../../tests/.car-image-sentinel.txt', isPrimary: false } });
    const response = await request(app).delete(`/api/v1/fleet/${car.id}/images/${malicious.id}`).set('Authorization', `Bearer ${editorToken}`);
    expect(response.status).toBe(200);
    expect(fs.existsSync(sentinel)).toBe(true);
    fs.unlinkSync(sentinel);
  });

  it('preserves outside files for Windows-like stored path normalization', async () => {
    fs.writeFileSync(sentinel, 'protected');
    const malicious = await prisma.carImage.create({ data: { carId: car.id, imageUrl: '..\\tests\\.car-image-sentinel.txt', isPrimary: false } });
    await request(app).delete(`/api/v1/fleet/${car.id}/images/${malicious.id}`).set('Authorization', `Bearer ${editorToken}`);
    expect(fs.existsSync(sentinel)).toBe(true);
    fs.unlinkSync(sentinel);
  });
});
