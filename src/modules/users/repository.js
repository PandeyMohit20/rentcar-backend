'use strict';

const { prisma } = require('../../config/database');

/**
 * Users repository — data access for user/profile/address/account entities.
 * All database queries are centralized here (never directly in controllers
 * or services). Queries use only existing database models/fields.
 */

const UsersRepository = {
  // ---- Users ----
  async findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findUserByPhone(phone) {
    return prisma.user.findFirst({ where: { phone } });
  },

  async findUserWithProfile(id) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  },

  async findUserWithRoles(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true, roles: { include: { role: true } } },
    });
    if (!user) return null;
    user.roles = (user.roles || []).map((ur) => ur.role);
    return user;
  },

  async updateUser(id, data) {
    return prisma.user.update({ where: { id }, data });
  },

  async softDeleteUser(id) {
    return prisma.user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), status: 'deleted' },
    });
  },

  async countUsers(where) {
    return prisma.user.count({ where });
  },

  async listUsers({ where, orderBy, skip, take }) {
    return prisma.user.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { roles: { include: { role: true } } },
    });
  },

  /** Find a role by name. */
  async findRoleByName(name) {
    return prisma.role.findUnique({ where: { name } });
  },

  /** Find user-role joins for a role id (used for SUPER_ADMIN protection). */
  async findUserRoleJoinsByRoleId(roleId) {
    return prisma.userRole.findMany({ where: { roleId } });
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
          include: { permissions: { include: { permission: true } } },
        },
      },
    });
    const roles = userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        userRoles.flatMap((ur) =>
          (ur.role.permissions || [])
            .map((rp) => rp.permission && rp.permission.name)
            .filter(Boolean),
        ),
      ),
    ];
    return { roles, permissions };
  },

  // ---- Profile ----
  async findProfileByUserId(userId) {
    return prisma.profile.findUnique({ where: { userId } });
  },

  async updateProfile(userId, data) {
    await prisma.profile.update({ where: { userId }, data });
    return prisma.profile.findUnique({ where: { userId } });
  },

  // ---- Sessions / tokens (revocation) ----
  async revokeAllSessionsForUser(userId) {
    return prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllRefreshTokensForUser(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // ---- Audit ----
  async logAudit({
    userId,
    action,
    module = 'users',
    entity,
    entityId,
    result = 'success',
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
        entity,
        entityId,
        result,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        requestId,
        ipAddress,
        userAgent,
      },
    });
  },
};

module.exports = { UsersRepository };
