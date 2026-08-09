'use strict';

const { UsersService } = require('./service');
const { success } = require('../../utils/response');

/**
 * Users controller — thin request handlers.
 * All business logic lives in UsersService. Controllers only translate
 * HTTP requests/responses.
 */

const UsersController = {
  // ---- SELF ----
  async getMe(req, res, next) {
    try {
      const user = await UsersService.getSelf(req.user.sub);
      return success(res, { message: 'Current user', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async updateMe(req, res, next) {
    try {
      const user = await UsersService.updateSelf(req.user.sub, req.body, req);
      return success(res, { message: 'Profile updated successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async deleteMe(req, res, next) {
    try {
      const result = await UsersService.deleteSelf(req.user.sub, req);
      return success(res, { message: 'Account deleted successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // ---- SELF: profile ----
  async getSelfProfile(req, res, next) {
    try {
      const profile = await UsersService.getSelfProfile(req.user.sub);
      return success(res, { message: 'Profile fetched successfully', data: { profile } });
    } catch (err) {
      return next(err);
    }
  },

  async updateSelfProfile(req, res, next) {
    try {
      const profile = await UsersService.updateSelfProfile(req.user.sub, req.body, req);
      return success(res, { message: 'Profile updated successfully', data: { profile } });
    } catch (err) {
      return next(err);
    }
  },

  // ---- SELF: preferences ----
  async getPreferences(req, res, next) {
    try {
      const preferences = await UsersService.getPreferences(req.user.sub);
      return success(res, { message: 'Preferences fetched successfully', data: { preferences } });
    } catch (err) {
      return next(err);
    }
  },

  async updatePreferences(req, res, next) {
    try {
      const preferences = await UsersService.updatePreferences(req.user.sub, req.body, req);
      return success(res, { message: 'Preferences updated successfully', data: { preferences } });
    } catch (err) {
      return next(err);
    }
  },

  // ---- ADMIN ----
  async listUsers(req, res, next) {
    try {
      const result = await UsersService.listUsers(req.query, req);
      return success(res, {
        message: 'Users fetched successfully',
        data: { items: result.items },
        meta: result.meta,
      });
    } catch (err) {
      return next(err);
    }
  },

  async getUser(req, res, next) {
    try {
      const user = await UsersService.getUser(req.params.userId);
      return success(res, { message: 'User details', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const user = await UsersService.updateUser(req.user.sub, req.params.userId, req.body, req);
      return success(res, { message: 'User updated successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const user = await UsersService.updateStatus(req.user.sub, req.params.userId, req.body.status, req);
      return success(res, { message: 'User status updated successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async activate(req, res, next) {
    try {
      const user = await UsersService.activate(req.user.sub, req.params.userId, req);
      return success(res, { message: 'User activated successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async deactivate(req, res, next) {
    try {
      const user = await UsersService.deactivate(req.user.sub, req.params.userId, req);
      return success(res, { message: 'User deactivated successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async suspend(req, res, next) {
    try {
      const user = await UsersService.suspend(req.user.sub, req.params.userId, req, req.body.reason);
      return success(res, { message: 'User suspended successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async block(req, res, next) {
    try {
      const user = await UsersService.block(req.user.sub, req.params.userId, req);
      return success(res, { message: 'User blocked successfully', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      const result = await UsersService.softDeleteUser(req.user.sub, req.params.userId, req);
      return success(res, { message: 'User deleted successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { UsersController };
