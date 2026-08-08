'use strict';

/**
 * One-time cleanup: removes unused imports from scaffolded module placeholder
 * files (repository.js and validator.js) so lint passes.
 * Run: node scripts/fix-module-placeholders.js
 */

const fs = require('fs');
const path = require('path');

const MODULES = [
  'users',
  'vendors',
  'fleet',
  'cars',
  'locations',
  'pricing',
  'availability',
  'bookings',
  'trips',
  'payments',
  'refunds',
  'wallet',
  'coupons',
  'invoices',
  'reviews',
  'notifications',
  'support',
  'reports',
  'analytics',
  'admin',
];

const modulesDir = path.resolve(__dirname, '..', 'src', 'modules');

const repositoryTemplate = (name) =>
  `'use strict';

/**
 * ${name.charAt(0).toUpperCase() + name.slice(1)} repository — data access.
 * Queries are centralized here (never directly in controllers).
 * Phase 19 placeholder. Implemented in a later phase.
 * Use the shared Prisma client: const { prisma } = require('../../config/database');
 */
const ${name.charAt(0).toUpperCase() + name.slice(1)}Repository = {};

module.exports = { ${name.charAt(0).toUpperCase() + name.slice(1)}Repository };
`;

const validatorTemplate = (name) =>
  `'use strict';

/**
 * ${name.charAt(0).toUpperCase() + name.slice(1)} validation schemas (Zod).
 * Phase 19 placeholder. Implemented in a later phase.
 * Use: const { z } = require('zod');
 */
module.exports = {};
`;

for (const name of MODULES) {
  const dir = path.join(modulesDir, name);
  fs.writeFileSync(path.join(dir, 'repository.js'), repositoryTemplate(name), 'utf8');
  fs.writeFileSync(path.join(dir, 'validator.js'), validatorTemplate(name), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Fixed ${name}/repository.js and ${name}/validator.js`);
}

// eslint-disable-next-line no-console
console.log('Module placeholder cleanup complete.');
