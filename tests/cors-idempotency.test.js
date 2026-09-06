'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { allowedOrigins } = require('../src/config/cors');

function parseAllowedHeaders(response) {
  return String(response.headers['access-control-allow-headers'] || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
}

describe('CORS idempotency header preflight', () => {
  let app;
  let origin;

  beforeAll(() => {
    app = createApp();
    [origin] = allowedOrigins;
  });

  it.each(['/api/v1/bookings', '/api/v1/bookings/00000000-0000-4000-8000-000000000000/cancel'])(
    'allows booking preflight headers for %s',
    async (route) => {
      const response = await request(app)
        .options(route)
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set(
          'Access-Control-Request-Headers',
          'authorization,content-type,idempotency-key',
        );

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(parseAllowedHeaders(response)).toEqual(
        expect.arrayContaining([
          'authorization',
          'content-type',
          'x-request-id',
          'idempotency-key',
        ]),
      );
    },
  );

  it('does not allow an arbitrary request header', async () => {
    const response = await request(app)
      .options('/api/v1/bookings')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-arbitrary-header');

    expect(response.status).toBe(204);
    expect(parseAllowedHeaders(response)).not.toContain('x-arbitrary-header');
  });
});
