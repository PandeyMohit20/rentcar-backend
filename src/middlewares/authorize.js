'use strict';

const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const httpStatus = require('../constants/httpStatus');
const { roles } = require('../constants/roles');
const { hasAnyPermission, hasAnyRole, isSuperAdmin } = require('../services/authorization.service');

/**
 * Authorization middleware.
 * Delegate all permission/role resolution to the centralized
 * authorization.service so business logic never hardcodes emails or user IDs.
 *
 * Usage:
 *   authorize('bookings.create')
 *   authorize(['bookings.create', 'admin.all'])
 *   authorizeRole('SUPER_ADMIN') or authorizeRole(['SUPER_ADMIN', 'PLATFORM_ADMIN'])
 *
 * req.user.permissions and req.user.roles are populated by the authenticate
 * middleware (DB-backed role/permission resolution).
 */

function authorize(requiredPermissions) {
  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          'Authentication required.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_UNAUTHORIZED,
        ),
      );
    }

    // SUPER_ADMIN has full system access (controlled, not email-hardcoded).
    if (isSuperAdmin(req.user)) {
      return next();
    }

    if (!hasAnyPermission(req.user, required)) {
      return next(
        new AppError(
          'Insufficient permissions to perform this action.',
          httpStatus.FORBIDDEN,
          errorCodes.AUTH_FORBIDDEN,
        ),
      );
    }
    return next();
  };
}

/**
 * Role-based authorization.
 * Usage: authorizeRole('SUPER_ADMIN') or authorizeRole(['SUPER_ADMIN', 'ANALYST']).
 * Prefer permission-based authorization for application business operations.
 */
function authorizeRole(requiredRoles) {
  const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          'Authentication required.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_UNAUTHORIZED,
        ),
      );
    }

    if (!hasAnyRole(req.user, required)) {
      return next(
        new AppError(
          'Insufficient permissions to perform this action.',
          httpStatus.FORBIDDEN,
          errorCodes.AUTH_FORBIDDEN,
        ),
      );
    }
    return next();
  };
}

module.exports = { authorize, authorizeRole, roles };
