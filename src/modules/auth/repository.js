'use strict';

const { prisma } = require('../../config/database');

/**
 * Auth repository — data access for authentication-related entities.
 * All database queries are centralized here (never directly in controllers/services).
 */

const AuthRepository = {
  // ---- Users ----
  async findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findUserByPhone(phone) {
    return prisma.user.findFirst({ where: { phone } });
  },

  async createUser({ email, phone, name, passwordHash, status }) {
    return prisma.user.create({
      data: { email, phone, name, passwordHash, status },
    });
  },

  async createProfile(userId, data = {}) {
    return prisma.profile.create({
      data: { userId, ...data },
    });
  },

  async updateUserPassword(userId, passwordHash) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  async updateLastLogin(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },

  async markEmailVerified(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  },

  async updateUserStatus(userId, status) {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  },

  async findUserWithProfile(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  },

  // ---- Roles & Permissions ----
  async findRoleByName(name) {
    return prisma.role.findUnique({ where: { name } });
  },

  async assignRole(userId, roleId) {
    return prisma.userRole.create({
      data: { userId, roleId },
    });
  },

  async findUserRoles(userId) {
    return prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
  },

  async findUserPermissions(userId) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    const roles = userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        userRoles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name)),
      ),
    ];
    return { roles, permissions };
  },

  // ---- Sessions ----
  async createSession({ userId, sessionTokenHash, expiresAt, ipAddress, userAgent, deviceSource }) {
    return prisma.session.create({
      data: {
        userId,
        sessionTokenHash,
        expiresAt,
        lastActiveAt: new Date(),
        ipAddress,
        userAgent,
        deviceSource,
      },
    });
  },

  async findSessionById(id) {
    return prisma.session.findUnique({ where: { id } });
  },

  async revokeSession(id) {
    return prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllSessionsForUser(userId) {
    return prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // ---- Refresh tokens ----
  async createRefreshToken({ userId, tokenHash, expiresAt }) {
    return prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  },

  async findRefreshTokenByHash(tokenHash) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  async revokeRefreshToken(id) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  async revokeRefreshTokenByHash(tokenHash) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllRefreshTokensForUser(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // ---- OTP ----
  async createOtp({ userId, purpose, codeHash, expiresAt }) {
    return prisma.otp.create({
      data: { userId, purpose, codeHash, expiresAt },
    });
  },

  async findLatestOtp(userId, purpose) {
    return prisma.otp.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
  },

  async markOtpVerified(id) {
    return prisma.otp.update({
      where: { id },
      data: { verifiedAt: new Date() },
    });
  },

  async incrementOtpAttempts(id) {
    return prisma.otp.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  },

  // ---- Audit / Activity logs ----
  async logActivity({ userId, action, module = 'auth', metadata, ipAddress, userAgent }) {
    return prisma.activityLog.create({
      data: {
        userId,
        action,
        module,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        ipAddress,
        userAgent,
      },
    });
  },

  async logAudit({
    userId,
    action,
    module = 'auth',
    result,
    metadata,
    requestId,
    ipAddress,
    userAgent,
  }) {
    return prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        result,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        requestId,
        ipAddress,
        userAgent,
      },
    });
  },
};

module.exports = { AuthRepository };
