'use strict';

const { prisma } = require('../../config/database');

/**
 * Profiles repository — data access for the Profile entity.
 * Queries are centralized here (never directly in controllers).
 */

const ProfileRepository = {
  async findProfileByUserId(userId) {
    return prisma.profile.findUnique({ where: { userId } });
  },

  async updateProfile(userId, data) {
    await prisma.profile.update({ where: { userId }, data });
    return prisma.profile.findUnique({ where: { userId } });
  },
};

module.exports = { ProfileRepository };
