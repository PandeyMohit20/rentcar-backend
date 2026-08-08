'use strict';

const AppError = require('../errors/AppError');
const errorCodes = require('../errors/errorCodes');
const httpStatus = require('../constants/httpStatus');
const { roles } = require('../constants/roles');

/**
 * Authorization middleware foundation.
 * Usage:
 *   authorize('bookings.create')
 *   authorize([ 'bookings.create', 'admin.all' ])
 *   authorizeRole('admin')
 *
 * req.user.permissions is expected to be populated by the auth flow
 * (full role/permission resolution is implemented in later phases).
 */
function authorize(allowedPermissions) {
  const required = Array.isArray(allowedPermissions) ? allowedPermissions : [allowedPermissions];
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required.', httpStatus.UNAUTHORIZED, errorCodes.UNAUTHORIZED),
      );
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = required.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      return next(
        new AppError(
          'Insufficient permissions to perform this action.',
          httpStatus.FORBIDDEN,
          errorCodes.INSUFFICIENT_PERMISSIONS,
        ),
      );
    }
    return next();
  };
}

/**
 * Role-based authorization.
 * Usage: authorizeRole('admin') or authorizeRole(['admin', 'support']).
 */
function authorizeRole(allowedRoles) {
  const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required.', httpStatus.UNAUTHORIZED, errorCodes.UNAUTHORIZED),
      );
    }
    const userRoles = req.user.roles || [];
    const hasRole = rolesList.some((role) => userRoles.includes(role));
    if (!hasRole) {
      return next(
        new AppError(
          'Insufficient permissions to perform this action.',
          httpStatus.FORBIDDEN,
          errorCodes.INSUFFICIENT_PERMISSIONS,
        ),
      );
    }
    return next();
  };
}

module.exports = { authorize, authorizeRole, roles };
