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
  // Minimal in-memory mock for tests that do not require a real DB.
  prisma = {
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: (fn) => (typeof fn === 'function' ? fn(prisma) : Promise.resolve(fn)),
    $queryRaw: async () => [{ 1n: 1n }],
    $queryRawUnsafe: async () => [{ 1n: 1n }],
    user: {},
    booking: {},
    payment: {},
    // Additional model stubs can be added as needed.
  };
} else {
  prisma = new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

module.exports = { prisma };
