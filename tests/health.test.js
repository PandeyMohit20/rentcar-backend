'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

describe('Health endpoints', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/v1/health', () => {
    it('returns HTTP 200 with success payload', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('RentCar API is healthy');
      expect(res.body.data.status).toBe('UP');
    });

    it('includes an X-Request-ID header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('GET /api/v1/health/database', () => {
    it('returns HTTP 200 with safe database status (mock DB)', async () => {
      const res = await request(app).get('/api/v1/health/database');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.connected).toBe(true);
      expect(res.body.data.dialect).toBe('mysql');
      // Must never expose credentials.
      expect(JSON.stringify(res.body)).not.toMatch(/mysql:\/\//);
    });
  });
});
