'use strict';
/* eslint-disable no-console */
process.env.NODE_ENV = 'test';
process.env.PORT = '5100';
process.env.API_PREFIX = '/api/v1';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/rentcar_test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_0123456789';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_0123456789';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.TEST_DATABASE_MOCK = 'true';

const request = require('supertest');
const { createApp } = require('../src/app');
const { resetStore, seedRole, seedUser } = require('./helpers/auth');

async function main() {
  const app = createApp();
  resetStore();
  await seedRole('CUSTOMER');
  await seedUser({ email: 'john@example.com', password: 'StrongPassword123!' });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'john@example.com', password: 'StrongPassword123!' });
  console.log('STATUS:', res.status);
  console.log('BODY:', JSON.stringify(res.body, null, 2));
}

main().catch((e) => {
  console.error('TOP ERROR', e);
  process.exit(1);
});
