'use strict';

const { prisma } = require('../../config/database');

/**
 * Auth repository — data access for auth-related entities.
 * Phase 19 foundation only. Full implementations come in Phase 20.
 * Queries are centralized here (never directly in controllers).
 */
const AuthRepository = {
  async findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },
};

module.exports = { AuthRepository };
