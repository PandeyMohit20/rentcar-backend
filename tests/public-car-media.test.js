'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');

describe('Public car media security headers', () => {
  const filename = 'test-public-car-media.svg';
  const directory = path.join(process.cwd(), 'uploads', 'cars');
  const file = path.join(directory, filename);
  let app;

  beforeAll(() => {
    app = createApp();
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  });

  afterAll(() => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it('allows cross-origin embedding only for an existing public car image', async () => {
    const response = await request(app).get(`/uploads/cars/${filename}`);
    expect(response.status).toBe(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('keeps private media non-public with Helmet same-origin protection', async () => {
    const privateStatic = await request(app).get('/uploads/private/users/private-document.pdf');
    expect(privateStatic.status).toBe(404);
    expect(privateStatic.headers['cross-origin-resource-policy']).toBe('same-origin');

    const privateDownload = await request(app).get(
      '/api/v1/kyc/documents/00000000-0000-4000-8000-000000000000/download',
    );
    expect(privateDownload.status).toBe(401);
    expect(privateDownload.headers['cross-origin-resource-policy']).toBe('same-origin');
  });
});
