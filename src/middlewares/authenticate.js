'use strict';

const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const httpStatus = require('../constants/httpStatus');
const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../config/database');
const { USER_STATUS } = require('../modules/auth/constants');

/**
 * Load a user's roles + permissions for `req.user`.
 * Resolves through the database-backed RBAC (UserRole -> Role -> permissions).
 */
async function loadAuthContext(userId) {
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
}

/**
 * Authentication middleware.
 * Reads `Authorization: Bearer <access_token>`, verifies the JWT, then
 * validates the account status and (when present) the session against the
 * database. On success it attaches a safe `req.user` containing:
 *   { sub, sessionId, roles, permissions, email }
 *
 * The database-backed checks ensure:
 *  - The user still exists.
 *  - The account is ACTIVE (blocked/suspended/inactive/deleted are rejected).
 *  - The session (if any) is not revoked and not expired.
 */

function accountStatusError(status) {
  switch (status) {
    case USER_STATUS.BLOCKED:
      return new AppError(
        'This account has been blocked.',
        httpStatus.FORBIDDEN,
        errorCodes.AUTH_ACCOUNT_BLOCKED,
      );
    case USER_STATUS.SUSPENDED:
      return new AppError(
        'This account has been suspended.',
        httpStatus.FORBIDDEN,
        errorCodes.AUTH_ACCOUNT_SUSPENDED,
      );
    case USER_STATUS.DELETED:
      return new AppError(
        'This account no longer exists.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_ACCOUNT_DELETED,
      );
    case USER_STATUS.INACTIVE:
      return new AppError(
        'This account is inactive.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_ACCOUNT_DISABLED,
      );
    case USER_STATUS.PENDING:
      return new AppError(
        'This account is pending verification.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_ACCOUNT_INACTIVE,
      );
    default:
      return new AppError(
        'This account is not active.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_ACCOUNT_DISABLED,
      );
  }
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(
      new AppError(
        'Authentication required. Provide a Bearer token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_UNAUTHORIZED,
      ),
    );
  }

  const token = header.slice(7).trim();
  if (!token) {
    return next(
      new AppError(
        'Authentication required. Provide a valid token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_UNAUTHORIZED,
      ),
    );
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return next(
      new AppError(
        isExpired ? 'Token has expired.' : 'Invalid or expired token.',
        httpStatus.UNAUTHORIZED,
        isExpired ? errorCodes.AUTH_TOKEN_EXPIRED : errorCodes.AUTH_TOKEN_INVALID,
      ),
    );
  }

  try {
    // Load the user from the database.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.isDeleted) {
      return next(
        new AppError(
          'Authentication required.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_UNAUTHORIZED,
        ),
      );
    }

    // Account status validation — only ACTIVE users can access protected APIs.
    if (user.status !== USER_STATUS.ACTIVE) {
      return next(accountStatusError(user.status));
    }

    // Session validation when the token carries a sessionId.
    if (payload.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
      });
      if (
        !session ||
        session.revokedAt ||
        (session.expiresAt && new Date(session.expiresAt) < new Date())
      ) {
        return next(
          new AppError(
            'Session is no longer valid.',
            httpStatus.UNAUTHORIZED,
            errorCodes.AUTH_SESSION_INVALID,
          ),
        );
      }
      // Touch lastActiveAt (no await — best effort, non-blocking).
      prisma.session
        .update({
          where: { id: session.id },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }

    // Resolve DB-backed roles + permissions for RBAC.
    const authCtx = await loadAuthContext(user.id);

    req.user = {
      sub: user.id,
      sessionId: payload.sessionId || null,
      email: user.email,
      roles: authCtx.roles,
      permissions: authCtx.permissions,
      status: user.status,
    };
    req.token = token;

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Token-only authentication: verifies the JWT and the user's account status,
 * but does NOT validate session revocation. This makes idempotent operations
 * such as logout work even after the session has been revoked.
 */
async function authenticateTokenOnly(req, res, next) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(
      new AppError(
        'Authentication required. Provide a Bearer token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_UNAUTHORIZED,
      ),
    );
  }

  const token = header.slice(7).trim();
  if (!token) {
    return next(
      new AppError(
        'Authentication required. Provide a valid token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_UNAUTHORIZED,
      ),
    );
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return next(
      new AppError(
        isExpired ? 'Token has expired.' : 'Invalid or expired token.',
        httpStatus.UNAUTHORIZED,
        isExpired ? errorCodes.AUTH_TOKEN_EXPIRED : errorCodes.AUTH_TOKEN_INVALID,
      ),
    );
  }

  try {
    // Load the user from the database.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.isDeleted) {
      return next(
        new AppError(
          'Authentication required.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_UNAUTHORIZED,
        ),
      );
    }

    // Only ACTIVE accounts can perform authenticated operations.
    if (user.status !== USER_STATUS.ACTIVE) {
      return next(accountStatusError(user.status));
    }

    req.user = {
      sub: user.id,
      sessionId: payload.sessionId || null,
      email: user.email,
      roles: [],
      permissions: [],
      status: user.status,
    };
    req.token = token;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authenticate, authenticateTokenOnly };
