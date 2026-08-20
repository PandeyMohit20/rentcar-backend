'use strict';

const { Router } = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { RolesController } = require('./controller');

const {
  roleIdParamSchema,
  createRoleSchema,
  updateRoleSchema,
  updateRoleStatusSchema,
  listRolesSchema,
} = require('./validator');

const router = Router();

// Create role
router.post(
  '/',
  authenticate,
  authorize('roles.create'),
  validate({ body: createRoleSchema }),
  RolesController.createRole,
);

// List roles
router.get(
  '/',
  authenticate,
  authorize('roles.view'),
  validate({ query: listRolesSchema }),
  RolesController.listRoles,
);

// Get role
router.get(
  '/:roleId',
  authenticate,
  authorize('roles.view'),
  validate({ params: roleIdParamSchema }),
  RolesController.getRoleById,
);

// Update role
router.patch(
  '/:roleId',
  authenticate,
  authorize('roles.update'),
  validate({
    params: roleIdParamSchema,
    body: updateRoleSchema,
  }),
  RolesController.updateRole,
);

// Update role status
router.patch(
  '/:roleId/status',
  authenticate,
  authorize('roles.status.update'),
  validate({
    params: roleIdParamSchema,
    body: updateRoleStatusSchema,
  }),
  RolesController.updateStatus,
);

// Delete role
router.delete(
  '/:roleId',
  authenticate,
  authorize('roles.delete'),
  validate({ params: roleIdParamSchema }),
  RolesController.deleteRole,
);

module.exports = { rolesRouter: router };
