'use strict';

const { PrismaClient } = require('@prisma/client');
const { env } = require('./env');

/**
 * Shared Prisma Client instance.
 * The Prisma Client is generated from rentcar-database (single source of truth).
 * This is the ONLY place PrismaClient is instantiated — services and
 * repositories consume this singleton. Do NOT create new PrismaClient
 * instances inside controllers.
 *
 * In test environments with TEST_DATABASE_MOCK=true, a lightweight mock is
 * provided so tests never touch a real/production database.
 */
let prisma;

if (env.TEST_DATABASE_MOCK) {
  // Functional in-memory mock for tests. Never touches a real database.
  // Supports the auth-related models used by the Phase 20 auth module.
  const { createMockPrisma } = require('./database.mock');
  prisma = createMockPrisma();
} else {
  prisma = new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

module.exports = { prisma };
