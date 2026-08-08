'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma } = require('../src/config/database');
const { resetStore, seedRole, seedUser } = require('./helpers/auth');
const { USER_STATUS } = require('../src/modules/auth/constants');

describe('Auth Login', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();
    await seedRole('CUSTOMER');
  });

  const email = 'john@example.com';
  const password = 'StrongPassword123!';

  describe('POST /api/v1/auth/login', () => {
    it('logs in successfully and returns access token + session', async () => {
      await seedUser({ email, password });
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.roles).toContain('CUSTOMER');
      // Never expose password hash.
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('returns generic error for wrong password', async () => {
      await seedUser({ email, password });
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('returns generic error for unknown email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('rejects an inactive account', async () => {
      await seedUser({ email, password, status: USER_STATUS.INACTIVE });
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_INACTIVE');
    });

    it('rejects a blocked account', async () => {
      await seedUser({ email, password, status: USER_STATUS.BLOCKED });
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_BLOCKED');
    });

    it('rejects a suspended account', async () => {
      await seedUser({ email, password, status: USER_STATUS.SUSPENDED });
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    });

    it('creates a session on login', async () => {
      const user = await seedUser({ email, password });
      await request(app).post('/api/v1/auth/login').send({ email, password });
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions.length).toBe(1);
    });

    it('stores a refresh token hash on login', async () => {
      const user = await seedUser({ email, password });
      await request(app).post('/api/v1/auth/login').send({ email, password });
      const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens.length).toBe(1);
      expect(tokens[0].tokenHash).toBeDefined();
      // Hash must not be the raw token.
      expect(tokens[0].tokenHash.length).toBe(64);
    });

    it('updates lastLoginAt on login', async () => {
      await seedUser({ email, password, lastLoginAt: null });
      await request(app).post('/api/v1/auth/login').send({ email, password });
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user.lastLoginAt).toBeTruthy();
    });

    it('sets the refresh token as an HttpOnly cookie', async () => {
      await seedUser({ email, password });
      const res = await request(app).post('/api/v1/auth/login').send({ email, password });
      const setCookie = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie'].join('; ')
        : String(res.headers['set-cookie']);
      expect(setCookie).toContain('refresh_token');
      expect(setCookie).toContain('HttpOnly');
    });
  });
});
