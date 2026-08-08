'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { prisma } = require('../src/config/database');
const { resetStore, seedRole, seedUser } = require('./helpers/auth');

describe('Auth Register', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    resetStore();
    await seedRole('CUSTOMER');
  });

  const validPayload = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+919999999999',
    password: 'StrongPassword123!',
  };

  describe('POST /api/v1/auth/register', () => {
    it('registers a user successfully with default CUSTOMER role', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.data.user.email).toBe('john@example.com');
      expect(res.body.data.user.name).toBe('John Doe');
      expect(res.body.data.user.roles).toContain('CUSTOMER');
      // Never expose the password hash.
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });

    it('normalizes email to lowercase', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validPayload, email: '  JOHN@Example.COM  ' });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('john@example.com');
    });

    it('rejects a duplicate email with AUTH_EMAIL_EXISTS', async () => {
      await seedUser({ email: 'john@example.com' });
      const res = await request(app).post('/api/v1/auth/register').send(validPayload);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('AUTH_EMAIL_EXISTS');
    });

    it('rejects a duplicate phone with AUTH_PHONE_EXISTS', async () => {
      await seedUser({ email: 'other@example.com', phone: '+919999999999' });
      const res = await request(app).post('/api/v1/auth/register').send(validPayload);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('AUTH_PHONE_EXISTS');
    });

    it('rejects a weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validPayload, password: 'weak' });
      expect(res.status).toBe(422);
    });

    it('rejects an invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validPayload, email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({});
      expect(res.status).toBe(422);
    });

    it('hashes the password (never stores plaintext)', async () => {
      await request(app).post('/api/v1/auth/register').send(validPayload);
      const user = await prisma.user.findUnique({ where: { email: 'john@example.com' } });
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe(validPayload.password);
      expect(user.passwordHash.length).toBeGreaterThan(20);
    });

    it('creates a profile record for the new user', async () => {
      await request(app).post('/api/v1/auth/register').send(validPayload);
      const user = await prisma.user.findUnique({ where: { email: 'john@example.com' } });
      const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      expect(profile).toBeTruthy();
    });

    it('rolls back the transaction when role assignment fails', async () => {
      // Force role assignment to fail by mocking.
      const originalCreate = prisma.userRole.create;
      prisma.userRole.create = async () => {
        throw new Error('boom');
      };
      try {
        const res = await request(app).post('/api/v1/auth/register').send(validPayload);
        expect(res.status).toBe(500);
      } finally {
        prisma.userRole.create = originalCreate;
      }
      // User should not exist after rollback.
      const user = await prisma.user.findUnique({ where: { email: 'john@example.com' } });
      expect(user).toBeNull();
    });
  });
});
