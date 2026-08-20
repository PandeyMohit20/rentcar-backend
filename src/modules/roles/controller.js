'use strict';

const roleService = require('./service');
const { success } = require('../../utils/response');

const RolesController = {
  async createRole(req, res, next) {
    try {
      const role = await roleService.createRole(req.body);

      return success(res, {
        message: 'Role created successfully',
        data: { role },
      });
    } catch (err) {
      return next(err);
    }
  },

  async listRoles(req, res, next) {
    try {
      const result = await roleService.listRoles(req.query);

      return success(res, {
        message: 'Roles fetched successfully',
        data: { items: result.data },
        meta: result.pagination,
      });
    } catch (err) {
      return next(err);
    }
  },

  async getRoleById(req, res, next) {
    try {
      const role = await roleService.getRoleById(req.params.roleId);

      return success(res, {
        message: 'Role details',
        data: { role },
      });
    } catch (err) {
      return next(err);
    }
  },

  async updateRole(req, res, next) {
    try {
      const role = await roleService.updateRole(
        req.params.roleId,
        req.body,
      );

      return success(res, {
        message: 'Role updated successfully',
        data: { role },
      });
    } catch (err) {
      return next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const role = await roleService.updateStatus(
        req.params.roleId,
        req.body.status,
      );

      return success(res, {
        message: 'Role status updated successfully',
        data: { role },
      });
    } catch (err) {
      return next(err);
    }
  },

  async deleteRole(req, res, next) {
    try {
      const result = await roleService.deleteRole(req.params.roleId);

      return success(res, {
        message: result.message,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { RolesController };
