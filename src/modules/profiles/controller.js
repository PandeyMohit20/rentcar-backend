'use strict';

const { ProfileService } = require('./service');
const { success } = require('../../utils/response');

/**
 * Profiles controller — thin request handlers.
 * All business logic lives in ProfileService.
 */

const ProfileController = {
  // GET /api/v1/profiles/me
  async getOwnProfile(req, res, next) {
    try {
      const profile = await ProfileService.getProfile(req.user.sub);
      return success(res, { message: 'Profile fetched successfully', data: { profile } });
    } catch (err) {
      return next(err);
    }
  },

  // PATCH /api/v1/profiles/me
  async updateOwnProfile(req, res, next) {
    try {
      const profile = await ProfileService.updateProfile(req.user.sub, req.body);
      return success(res, { message: 'Profile updated successfully', data: { profile } });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { ProfileController };
