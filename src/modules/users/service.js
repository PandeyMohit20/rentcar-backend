'use strict';

const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');
const { USER_STATUS, STATUS_TRANSITIONS, USER_EVENTS } = require('./constants');
const { UsersRepository } = require('./repository');
const { toUserResponse, toUserDetailResponse, toUserListResponse, toProfile } = require('./mapper');
const { parsePagination, computeTotalPages, buildMeta } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');
const { logger } = require('../../config/logger');

/**
 * Users service — user/profile/address/account business logic.
 * Controllers are thin; all business rules live here.
 */

/** Normalize email: trim + lowercase. */
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** Normalize phone: strip spaces, hyphens, parentheses. */
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone)
    .replace(/[\s\-()]/g, '')
    .trim();
}

function getClientInfo(req) {
  return {
    ipAddress: req.ip || req.ipAddress || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.requestId || null,
  };
}

async function emitEvent(userId, action, ctx, metadata = {}, opts = {}) {
  try {
    await UsersRepository.logAudit({
      userId,
      action,
      entity: opts.entity,
      entityId: opts.entityId,
      result: opts.result || 'success',
      metadata,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    logger.warn('Failed to write audit log', { code: 'AUDIT_LOG_FAILED' });
  }
}

/** Validate that a status transition source -> target is allowed. */
function assertValidTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new AppError(
      `Invalid status transition from '${from}' to '${to}'.`,
      httpStatus.UNPROCESSABLE_ENTITY,
      errorCodes.USER_STATUS_TRANSITION_INVALID,
      { from, to },
    );
  }
}

/** Load roles + permissions for a user. */
async function loadAuthContext(userId) {
  const { roles, permissions } = await UsersRepository.findUserPermissions(userId);
  return { roles, permissions };
}

/** Assert that at least one active SUPER_ADMIN remains after a change. */
async function assertSuperAdminProtected(targetUserId) {
  const superRole = await UsersRepository.findRoleByName('SUPER_ADMIN');
  if (!superRole) return; // No SUPER_ADMIN role exists — nothing to protect.

  const joins = await UsersRepository.findUserRoleJoinsByRoleId(superRole.id);
  const superAdminUserIds = joins.map((j) => j.userId);

  // Only active, non-deleted SUPER_ADMINs count.
  const activeSuperAdmins = [];
  for (const uid of superAdminUserIds) {
    const u = await UsersRepository.findUserById(uid);
    if (u && u.status === USER_STATUS.ACTIVE && !u.isDeleted) activeSuperAdmins.push(u);
  }

  const isTargetSuperAdmin = activeSuperAdmins.some((u) => u.id === targetUserId);
  if (isTargetSuperAdmin && activeSuperAdmins.length === 1) {
    throw new AppError(
      'Cannot modify the last active SUPER_ADMIN account.',
      httpStatus.FORBIDDEN,
      errorCodes.USER_LAST_SUPER_ADMIN_PROTECTED,
    );
  }
}

const UsersService = {
  // ---- SELF: GET /users/me ----
  async getSelf(userId) {
    const user = await UsersRepository.findUserWithRoles(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    const ctx = await loadAuthContext(userId);
    return toUserResponse(user, {
      roles: ctx.roles,
      permissions: ctx.permissions,
      profile: user.profile,
    });
  },

  // ---- SELF: PATCH /users/me ----
  async updateSelf(userId, data, req) {
    const ctx = getClientInfo(req);
    const user = await UsersRepository.findUserById(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }

    const updateData = {};
    const metadata = { changed: [] };

    if (data.name !== undefined) {
      updateData.name = String(data.name).trim();
      metadata.changed.push('name');
    }

    if (data.phone !== undefined) {
      const phone = normalizePhone(data.phone);
      if (phone && phone !== user.phone) {
        const existing = await UsersRepository.findUserByPhone(phone);
        if (existing && existing.id !== userId) {
          throw new AppError(
            'An account with this phone number already exists.',
            httpStatus.CONFLICT,
            errorCodes.USER_PHONE_EXISTS,
          );
        }
      }
      updateData.phone = phone;
      if (phone) metadata.changed.push('phone');
    }

    if (data.email !== undefined) {
      const email = normalizeEmail(data.email);
      if (email !== user.email) {
        const existing = await UsersRepository.findUserByEmail(email);
        if (existing && existing.id !== userId) {
          throw new AppError(
            'An account with this email already exists.',
            httpStatus.CONFLICT,
            errorCodes.USER_EMAIL_EXISTS,
          );
        }
        updateData.email = email;
        // A changed email is never treated as verified.
        updateData.emailVerifiedAt = null;
        metadata.changed.push('email');
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError(
        'No updatable fields provided.',
        httpStatus.BAD_REQUEST,
        errorCodes.USER_UPDATE_FAILED,
      );
    }

    const updated = await UsersRepository.updateUser(userId, updateData);
    await emitEvent(userId, USER_EVENTS.USER_UPDATED, ctx, metadata, {
      entity: 'user',
      entityId: userId,
    });

    const ctxAuth = await loadAuthContext(userId);
    const withProfile = await UsersRepository.findUserWithProfile(userId);
    return toUserResponse(updated, {
      roles: ctxAuth.roles,
      permissions: ctxAuth.permissions,
      profile: withProfile ? withProfile.profile : null,
    });
  },

  // ---- SELF: profile ----
  async getSelfProfile(userId) {
    const user = await UsersRepository.findUserWithProfile(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    return toProfile(user.profile);
  },

  async updateSelfProfile(userId, data, req) {
    const ctx = getClientInfo(req);
    const user = await UsersRepository.findUserWithProfile(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    if (!user.profile) {
      throw new AppError(
        'Profile not found.',
        httpStatus.NOT_FOUND,
        errorCodes.PROFILE_UPDATE_FAILED,
      );
    }
    const profileData = {};
    if (data.dateOfBirth !== undefined)
      profileData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.gender !== undefined) profileData.gender = data.gender;
    if (data.bio !== undefined) profileData.bio = data.bio;

    const updated = await UsersRepository.updateProfile(userId, profileData);
    await emitEvent(
      userId,
      USER_EVENTS.PROFILE_UPDATED,
      ctx,
      {},
      { entity: 'profile', entityId: userId },
    );
    return toProfile(updated);
  },

  // ---- ADMIN: list ----
  async listUsers(query, req) {
    const ctx = getClientInfo(req);
    const { page, limit, offset } = parsePagination(query);
    const orderBy = parseSort(
      query.sortBy ? `${query.sortOrder === 'desc' ? '-' : ''}${query.sortBy}` : '-createdAt',
      ['createdAt', 'updatedAt', 'name', 'email', 'status', 'lastLoginAt'],
    );

    const where = { isDeleted: false };

    if (query.search) {
      where.OR = [
        { name: { contains: String(query.search) } },
        { email: { contains: String(query.search) } },
        { phone: { contains: String(query.search) } },
      ];
    }
    if (query.email) where.email = normalizeEmail(query.email);
    if (query.phone) where.phone = normalizePhone(query.phone);
    if (query.status) where.status = query.status;
    if (query.role) {
      // role filter resolved via userRole join (role name).
      const role = await UsersRepository.findRoleByName(query.role);
      if (!role) {
        return { items: [], meta: buildMeta({ page, limit, total: 0, totalPages: 0 }) };
      }
      const joins = await UsersRepository.findUserRoleJoinsByRoleId(role.id);
      where.id = { in: joins.map((j) => j.userId) };
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) where.createdAt.lte = new Date(query.createdTo);
    }

    const [total, rows] = await Promise.all([
      UsersRepository.countUsers(where),
      UsersRepository.listUsers({ where, orderBy, skip: offset, take: limit }),
    ]);

    const items = rows.map((u) => toUserListResponse(u));
    const totalPages = computeTotalPages(total, limit);
    await emitEvent(null, 'user.list', ctx, { page, limit }, { entity: 'user' });
    return { items, meta: buildMeta({ page, limit, total, totalPages }) };
  },

  // ---- ADMIN: get one ----
  async getUser(userId) {
    const user = await UsersRepository.findUserWithRoles(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    const ctx = await loadAuthContext(userId);
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return toUserDetailResponse(user, {
      roles: ctx.roles,
      permissions: ctx.permissions,
      profile: user.profile,
      addresses,
    });
  },

  // ---- ADMIN: update ----
  async updateUser(actorId, userId, data, req) {
    const ctx = getClientInfo(req);
    const user = await UsersRepository.findUserById(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }

    const updateData = {};
    const metadata = { changed: [] };
    if (data.name !== undefined) {
      updateData.name = String(data.name).trim();
      metadata.changed.push('name');
    }
    if (data.phone !== undefined) {
      const phone = normalizePhone(data.phone);
      if (phone && phone !== user.phone) {
        const existing = await UsersRepository.findUserByPhone(phone);
        if (existing && existing.id !== userId) {
          throw new AppError(
            'An account with this phone number already exists.',
            httpStatus.CONFLICT,
            errorCodes.USER_PHONE_EXISTS,
          );
        }
      }
      updateData.phone = phone;
      if (phone) metadata.changed.push('phone');
    }

    // Profile fields are managed via the profile module; admin update may
    // accept dateOfBirth/gender but never password/tokens/roles here.
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) updateData.gender = data.gender;

    if (Object.keys(updateData).length === 0) {
      throw new AppError(
        'No updatable fields provided.',
        httpStatus.BAD_REQUEST,
        errorCodes.USER_UPDATE_FAILED,
      );
    }

    const updated = await UsersRepository.updateUser(userId, updateData);
    await emitEvent(actorId, USER_EVENTS.USER_UPDATED, ctx, metadata, {
      entity: 'user',
      entityId: userId,
    });
    const ctxAuth = await loadAuthContext(userId);
    return toUserResponse(updated, { roles: ctxAuth.roles, permissions: ctxAuth.permissions });
  },

  // ---- ADMIN: status update ----
  async updateStatus(actorId, userId, targetStatus, req) {
    const ctx = getClientInfo(req);
    const user = await UsersRepository.findUserById(userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    if (!Object.values(USER_STATUS).includes(targetStatus)) {
      throw new AppError(
        'Invalid status.',
        httpStatus.UNPROCESSABLE_ENTITY,
        errorCodes.USER_STATUS_INVALID,
      );
    }
    assertValidTransition(user.status, targetStatus);

    // Protect the last active SUPER_ADMIN from being disabled.
    if (targetStatus !== USER_STATUS.ACTIVE) {
      await assertSuperAdminProtected(userId);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: targetStatus } });
      // Revoke sessions + refresh tokens when the account is no longer active.
      if (targetStatus !== USER_STATUS.ACTIVE) {
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });

    await emitEvent(
      actorId,
      USER_EVENTS.USER_STATUS_CHANGED,
      ctx,
      { from: user.status, to: targetStatus },
      { entity: 'user', entityId: userId },
    );
    return toUserResponse({ ...user, status: targetStatus });
  },

  // ---- ADMIN: activate / deactivate / suspend / block ----
  async activate(actorId, userId, req) {
    return this.updateStatus(actorId, userId, USER_STATUS.ACTIVE, req).then(async (u) => {
      await emitEvent(
        actorId,
        USER_EVENTS.USER_ACTIVATED,
        getClientInfo(req),
        {},
        { entity: 'user', entityId: userId },
      );
      return u;
    });
  },

  async deactivate(actorId, userId, req) {
    return this.updateStatus(actorId, userId, USER_STATUS.INACTIVE, req).then(async (u) => {
      await emitEvent(
        actorId,
        USER_EVENTS.USER_DEACTIVATED,
        getClientInfo(req),
        {},
        { entity: 'user', entityId: userId },
      );
      return u;
    });
  },

  async suspend(actorId, userId, req, reason) {
    const u = await this.updateStatus(actorId, userId, USER_STATUS.SUSPENDED, req);
    await emitEvent(
      actorId,
      USER_EVENTS.USER_SUSPENDED,
      getClientInfo(req),
      { reason: reason || null },
      { entity: 'user', entityId: userId },
    );
    return u;
  },

  async block(actorId, userId, req) {
    const u = await this.updateStatus(actorId, userId, USER_STATUS.BLOCKED, req);
    await emitEvent(
      actorId,
      USER_EVENTS.USER_BLOCKED,
      getClientInfo(req),
      {},
      { entity: 'user', entityId: userId },
    );
    return u;
  },

  // ---- ADMIN: soft delete ----
  async softDeleteUser(actorId, userId, req) {
    const ctx = getClientInfo(req);
    const user = await UsersRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    if (user.isDeleted || user.status === USER_STATUS.DELETED) {
      throw new AppError(
        'User is already deleted.',
        httpStatus.CONFLICT,
        errorCodes.USER_ALREADY_DELETED,
      );
    }
    await assertSuperAdminProtected(userId);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isDeleted: true, deletedAt: new Date(), status: USER_STATUS.DELETED },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await emitEvent(
      actorId,
      USER_EVENTS.USER_DELETED,
      ctx,
      {},
      { entity: 'user', entityId: userId },
    );
    return { success: true };
  },

  // ---- SELF: delete ----
  async deleteSelf(userId, req) {
    const ctx = getClientInfo(req);
    const user = await UsersRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.USER_NOT_FOUND);
    }
    if (user.isDeleted || user.status === USER_STATUS.DELETED) {
      throw new AppError(
        'User is already deleted.',
        httpStatus.CONFLICT,
        errorCodes.USER_ALREADY_DELETED,
      );
    }
    await assertSuperAdminProtected(userId);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isDeleted: true, deletedAt: new Date(), status: USER_STATUS.DELETED },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await emitEvent(
      userId,
      USER_EVENTS.USER_DELETED,
      ctx,
      {},
      { entity: 'user', entityId: userId },
    );
    return { success: true };
  },

  // ---- PREFERENCES (gap: no DB model) ----
  async getPreferences(_userId) {
    // No preferences model exists in the schema. Documented in database-gaps.md.
    return {};
  },

  async updatePreferences(_userId, _data, _req) {
    throw new AppError(
      'User preferences are not supported by the database schema in this phase.',
      httpStatus.SERVICE_UNAVAILABLE,
      errorCodes.PREFERENCE_UPDATE_FAILED,
    );
  },
};

module.exports = { UsersService };
