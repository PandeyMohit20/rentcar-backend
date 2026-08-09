'use strict';

const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');
const { ProfileRepository } = require('./repository');
const { toProfile } = require('../users/mapper');

/**
 * Profiles service — profile business logic.
 * Profile identity is kept separate from user identity/account.
 */

const ProfileService = {
  async getProfile(userId) {
    const profile = await ProfileRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new AppError(
        'Profile not found.',
        httpStatus.NOT_FOUND,
        errorCodes.PROFILE_UPDATE_FAILED,
      );
    }
    return toProfile(profile);
  },

  async updateProfile(userId, data) {
    const existing = await ProfileRepository.findProfileByUserId(userId);
    if (!existing) {
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
    if (data.profileImage !== undefined) profileData.profileImage = data.profileImage;

    if (Object.keys(profileData).length === 0) {
      throw new AppError(
        'No updatable profile fields provided.',
        httpStatus.BAD_REQUEST,
        errorCodes.PROFILE_UPDATE_FAILED,
      );
    }
    const updated = await ProfileRepository.updateProfile(userId, profileData);
    return toProfile(updated);
  },
};

module.exports = { ProfileService };
