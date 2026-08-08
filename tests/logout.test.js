'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma } = require('../src/config/database');
const { signAccessToken } = require('../src/utils/jwt');
const { resetStore, seedRole, seedUser, seedSession, seedRefreshToken } = require('./helpers/auth');

describe('Auth Logout', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();
    await seedRole('CUSTOMER');
  });

  /** Create a user + session + access token bound to that session. */
  async function makeAuthedAgent() {
    const user = await seedUser({});
    const { session } = await seedSession(user.id);
    const accessToken = signAccessToken({
      sub: user.id,
      role: 'CUSTOMER',
      sessionId: session.id,
      type: 'access',
    });
    return { user, session, accessToken };
  }

  describe('POST /api/v1/auth/logout', () => {
    it('revokes the session on logout', async () => {
      const { user, session, accessToken } = await makeAuthedAgent();
      await seedRefreshToken(user.id);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const s = await prisma.session.findUnique({ where: { id: session.id } });
      expect(s.revokedAt).toBeTruthy();
    });

    it('is idempotent (logging out twice succeeds)', async () => {
      const { user, accessToken } = await makeAuthedAgent();
      await seedRefreshToken(user.id);

      const first = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(first.status).toBe(200);

      const second = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      // Second logout still succeeds (idempotent).
      expect(second.status).toBe(200);
    });

    it('requires authentication', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('revokes all sessions and refresh tokens for the user', async () => {
      const user = await seedUser({});
      const { session: s1 } = await seedSession(user.id);
      await seedSession(user.id);
      await seedRefreshToken(user.id);
      await seedRefreshToken(user.id);

      const accessToken = signAccessToken({
        sub: user.id,
        role: 'CUSTOMER',
        sessionId: s1.id,
        type: 'access',
      });

      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions.every((s) => s.revokedAt)).toBe(true);
      const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens.every((t) => t.revokedAt)).toBe(true);
    });
  });
});
