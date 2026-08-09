'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { resetStore, seedUser, seedRole } = require('./helpers/auth');

describe('Profile routes', () => {
  let app;
  const email = 'jane@example.com';
  const password = 'StrongPassword123!';

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();
    await seedRole('CUSTOMER');
  });

  async function login() {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    return res.body.data.accessToken;
  }

  it('returns the current user profile via /profiles/me', async () => {
    await seedUser({ email, password });
    const token = await login();

    const res = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile).toMatchObject({
      verificationStatus: null,
      gender: null,
      bio: null,
    });
  });

  it('updates the profile through /profiles/me and reads it through /users/me/profile', async () => {
    await seedUser({ email, password });
    const token = await login();

    const patchRes = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateOfBirth: '1990-01-01', gender: 'female', bio: 'Test profile bio' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.profile).toMatchObject({ gender: 'female', bio: 'Test profile bio' });

    const getRes = await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.profile).toMatchObject({ gender: 'female', bio: 'Test profile bio' });
  });
});
