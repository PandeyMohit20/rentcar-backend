'use strict';

const request = require('supertest');
const express = require('express');
const { createApp } = require('../src/app');
const { authenticate } = require('../src/middlewares/authenticate');
const { errorHandler } = require('../src/middlewares/errorHandler');

describe('Error handling', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('404 handler', () => {
    it('returns 404 with standard error response for unknown routes', async () => {
      const res = await request(app).get('/api/v1/non-existing-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found');
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('501 Not Implemented for future modules', () => {
    it('returns 401 for protected /api/v1/users', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('returns 501 for /api/v1/bookings', async () => {
      const res = await request(app).get('/api/v1/bookings');
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('Vendor route protection', () => {
    it('rejects unauthenticated vendor access', async () => {
      const res = await request(app).get('/api/v1/vendors');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });
  });

  describe('Fleet image and feature protection', () => {
    it('rejects unauthenticated car image requests', async () => {
      const res = await request(app).get('/api/v1/fleet/00000000-0000-4000-8000-000000000001/images');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated car feature requests', async () => {
      const res = await request(app).get('/api/v1/fleet/00000000-0000-4000-8000-000000000001/features');
      expect(res.status).toBe(401);
    });
  });

  describe('Authentication middleware', () => {
    const buildTestApp = () => {
      const testApp = express();
      testApp.get('/protected', authenticate, (req, res) => res.json({ ok: true }));
      testApp.use(errorHandler);
      return testApp;
    };

    it('returns 401 when no token is provided', async () => {
      // There is no protected route in Phase 19, but we can verify the
      // middleware directly by mounting it on a test route.
      const res = await request(buildTestApp()).get('/protected');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('returns 401 for an invalid token with AUTH_TOKEN_INVALID code', async () => {
      const res = await request(buildTestApp())
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });
});
