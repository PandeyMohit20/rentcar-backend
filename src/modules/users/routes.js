'use strict';

const { Router } = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { UsersController } = require('./controller');
const {
  idParamSchema,
  listUsersSchema,
  updateSelfSchema,
  updateUserSchema,
  updateProfileSchema,
  updateStatusSchema,
  suspendSchema,
} = require('./validator');

const router = Router();

/**
 * All user endpoints require authentication.
 * Self-service routes only require a valid authenticated user.
 * Admin routes additionally require the corresponding permission.
 */

// ---- Self-service ----
router.get('/me', authenticate, UsersController.getMe);
router.patch('/me', authenticate, validate({ body: updateSelfSchema }), UsersController.updateMe);
router.delete('/me', authenticate, UsersController.deleteMe);

router.get('/me/profile', authenticate, UsersController.getSelfProfile);
router.patch(
  '/me/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  UsersController.updateSelfProfile,
);

router.get('/me/preferences', authenticate, UsersController.getPreferences);
router.patch('/me/preferences', authenticate, UsersController.updatePreferences);

// ---- Admin: user management ----
router.get(
  '/',
  authenticate,
  authorize('users.view'),
  validate({ query: listUsersSchema }),
  UsersController.listUsers,
);

router.get(
  '/:userId',
  authenticate,
  authorize('users.view'),
  validate({ params: idParamSchema }),
  UsersController.getUser,
);

router.patch(
  '/:userId',
  authenticate,
  authorize('users.update'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  UsersController.updateUser,
);

router.patch(
  '/:userId/status',
  authenticate,
  authorize('users.status.update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  UsersController.updateStatus,
);

router.patch(
  '/:userId/activate',
  authenticate,
  authorize('users.activate'),
  validate({ params: idParamSchema }),
  UsersController.activate,
);

router.patch(
  '/:userId/deactivate',
  authenticate,
  authorize('users.deactivate'),
  validate({ params: idParamSchema }),
  UsersController.deactivate,
);

router.patch(
  '/:userId/suspend',
  authenticate,
  authorize('users.suspend'),
  validate({ params: idParamSchema, body: suspendSchema }),
  UsersController.suspend,
);

router.patch(
  '/:userId/block',
  authenticate,
  authorize('users.block'),
  validate({ params: idParamSchema }),
  UsersController.block,
);

router.delete(
  '/:userId',
  authenticate,
  authorize('users.delete'),
  validate({ params: idParamSchema }),
  UsersController.deleteUser,
);

module.exports = { usersRouter: router };
