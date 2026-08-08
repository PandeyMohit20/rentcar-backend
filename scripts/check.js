'use strict';

/**
 * Startup sanity check.
 * Verifies environment, config, and application boot without starting a server.
 * Run: npm run check
 */

const { env } = require('../src/config/env');

// eslint-disable-next-line no-console
console.log('✅ Environment configuration valid');
// eslint-disable-next-line no-console
console.log(`   NODE_ENV=${env.NODE_ENV}`);
// eslint-disable-next-line no-console
console.log(`   PORT=${env.PORT}`);
// eslint-disable-next-line no-console
console.log(`   API_PREFIX=${env.API_PREFIX}`);
// eslint-disable-next-line no-console
console.log(`   DATABASE_URL=${env.DATABASE_URL ? 'configured' : 'MISSING'}`);
// eslint-disable-next-line no-console
console.log(`   JWT_ACCESS_SECRET=${env.JWT_ACCESS_SECRET ? 'configured' : 'MISSING'}`);
// eslint-disable-next-line no-console
console.log(`   JWT_REFRESH_SECRET=${env.JWT_REFRESH_SECRET ? 'configured' : 'MISSING'}`);

try {
  const { createApp } = require('../src/app');
  const app = createApp();
  // eslint-disable-next-line no-console
  console.log(`✅ Express app created (${app ? 'ok' : 'failed'})`);
  process.exit(0);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('❌ Application boot failed:', err.message);
  process.exit(1);
}
