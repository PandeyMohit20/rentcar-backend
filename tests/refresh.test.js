'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma } = require('../src/config/database');
const { signRefreshToken, verifyAccessToken } = require('../src/utils/jwt');
const { hashSecret } = require('../src/modules/auth/auth.utils');
const {
  resetStore,
  seedRole,
  seedUser,
  seedSession,
  seedRefreshToken,
} = require('./helpers/auth');

describe('Auth Refresh (Token Rotation)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();
    await seedRole('CUSTOMER');
  });

  /** Build a valid, stored refresh JWT for the user/session. */
  async function makeStoredRefreshJwt(user, session, overrides = {}) {
    const jwt = signRefreshToken({
      sub: user.id,
      sessionId: session.id,
      type: 'refresh',
      ...overrides,
    });
    return jwt;
  }

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates a valid refresh token', async () => {
      const user = await seedUser({});
      const { session } = await seedSession(user.id);
      const jwt = await makeStoredRefreshJwt(user, session);
      await seedRefreshToken(user.id, { tokenValue: jwt });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: jwt });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // The old token should be revoked.
      const old = await prisma.refreshToken.findUnique({ where: { tokenHash: hashSecret(jwt) } });
      expect(old.revokedAt).toBeTruthy();
    });

    it('returns a new access token that verifies', async () => {
      const user = await seedUser({});
      const { session } = await seedSession(user.id);
      const jwt = await makeStoredRefreshJwt(user, session);
      await seedRefreshToken(user.id, { tokenValue: jwt });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: jwt });

const decoded = verifyAccessToken(res.body.data.accessToken);
      expect(decoded.sub).toBe(user.id);
    });

    it('rejects an invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-valid-jwt' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('rejects a revoked refresh token', async () => {
      const user = await seedUser({});
      const { session } = await seedSession(user.id);
      const jwt = await makeStoredRefreshJwt(user, session);
      await seedRefreshToken(user.id, { tokenValue: jwt, revoked: true });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: jwt });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REFRESH_TOKEN_REVOKED');
    });

    it('detects refresh token reuse of an already-rotated token', async () => {
      const user = await seedUser({});
      const { session } = await seedSession(user.id);
      const jwt = await makeStoredRefreshJwt(user, session);
      await seedRefreshToken(user.id, { tokenValue: jwt });

      // First refresh consumes (rotates) the old token.
      const first = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: jwt });
      expect(first.status).toBe(200);

      // Reusing the old token must be detected as reuse.
      const second = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: jwt });
      expect(second.status).toBe(401);
      expect(second.body.error.code).toBe('AUTH_REFRESH_TOKEN_REUSE');
    });

    it('rejects an expired refresh token', async () => {
      const user = await seedUser({});
      const { session } = await seedSession(user.id);
      const jwt = signRefreshToken({
        sub: user.id,
        sessionId: session.id,
        type: 'refresh',
      });
      // Seed an expired stored token (hash matches the JWT).
      await seedRefreshToken(user.id, { tokenValue: jwt, expired: true });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: jwt });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('revokes the session when a revoked token is reused', async () => {
      const user = await seedUser({});
      const { session } = await seedSession(user.id);
      const jwt = await makeStoredRefreshJwt(user, session);
      await seedRefreshToken(user.id, { tokenValue: jwt, revoked: true });

      await request(app).post('/api/v1/auth/refresh').send({ refreshToken: jwt });
      const s = await prisma.session.findUnique({ where: { id: session.id } });
      expect(s.revokedAt).toBeTruthy();
    });
  });
});
