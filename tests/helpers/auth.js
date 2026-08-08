'use strict';

const { prisma } = require('../../src/config/database');
const { hashPassword } = require('../../src/utils/password');
const { hashSecret, randomToken } = require('../../src/modules/auth/auth.utils');
const { USER_STATUS } = require('../../src/modules/auth/constants');

/**
 * Test helpers for auth tests.
 * Seeds the in-memory Prisma mock with roles, permissions, and users.
 */

const { $store } = prisma;

/** Clear all in-memory data between tests. */
function resetStore() {
  Object.keys($store).forEach((key) => {
    $store[key].length = 0;
  });
}

/** Seed a role into the store. */
async function seedRole(name, { permissions = [], isSystem = true } = {}) {
  const role = await prisma.role.create({ data: { name, isSystem } });
  for (const perm of permissions) {
    let permission = await prisma.permission.findUnique({ where: { name: perm } });
    if (!permission) {
      const [module, action] = perm.split('.');
      permission = await prisma.permission.create({
        data: { name: perm, module, action },
      });
    }
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
  }
  return role;
}

/** Seed a user with the given role(s) and permissions. */
async function seedUser({
  name = 'Test User',
  email,
  phone = '+919999999999',
  password = 'StrongPassword123!',
  status = USER_STATUS.ACTIVE,
  roles = ['CUSTOMER'],
  emailVerifiedAt = new Date(),
  lastLoginAt = null,
} = {}) {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      status,
      emailVerifiedAt,
      lastLoginAt,
    },
  });

  await prisma.profile.create({ data: { userId: user.id } });

  for (const roleName of roles) {
    let role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) role = await seedRole(roleName);
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }

  return user;
}

/** Create a session for a user. */
async function seedSession(userId, { revoked = false } = {}) {
  const sessionToken = randomToken(32);
  const session = await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: hashSecret(sessionToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      ...(revoked ? { revokedAt: new Date() } : {}),
    },
  });
  return { session, sessionToken };
}

/**
 * Create a refresh token for a user.
 * The stored tokenHash corresponds to the raw `tokenValue` (the JWT sent to
 * the client). Pass `tokenValue` to control the stored hash; otherwise a
 * random token is used.
 */
async function seedRefreshToken(
  userId,
  { revoked = false, expired = false, tokenValue = null } = {},
) {
  const value = tokenValue || randomToken(48);
  const token = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashSecret(value),
      expiresAt: new Date(Date.now() + (expired ? -1000 : 7 * 24 * 60 * 60 * 1000)),
      ...(revoked ? { revokedAt: new Date() } : {}),
    },
  });
  return { token, refreshToken: value };
}

/** Create an OTP for a user. */
async function seedOtp(
  userId,
  purpose,
  otp,
  { expired = false, attempts = 0, verified = false } = {},
) {
  return prisma.otp.create({
    data: {
      userId,
      purpose,
      codeHash: hashSecret(otp),
      expiresAt: new Date(Date.now() + (expired ? -1000 : 10 * 60 * 1000)),
      attemptCount: attempts,
      ...(verified ? { verifiedAt: new Date() } : {}),
    },
  });
}

module.exports = {
  resetStore,
  seedRole,
  seedUser,
  seedSession,
  seedRefreshToken,
  seedOtp,
  $store,
  prisma,
};
