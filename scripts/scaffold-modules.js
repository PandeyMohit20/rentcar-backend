'use strict';

/**
 * Scaffolds the standard module file structure for all future modules.
 * Each module gets controller.js, service.js, repository.js, routes.js,
 * validator.js, and constants.js placeholder files.
 *
 * Run: node scripts/scaffold-modules.js
 * (Modules already present are skipped.)
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

const FILE_TEMPLATES = {
  'controller.js': (m) =>
    `'use strict';

/**
 * ${m} controller — thin handlers that call the service.
 * Phase 19 placeholder. Implemented in a later phase.
 */
const ${fileClassName(m)}Controller = {};

module.exports = { ${fileClassName(m)}Controller };
`,
  'service.js': (m) =>
    `'use strict';

/**
 * ${m} service — business logic.
 * Phase 19 placeholder. Implemented in a later phase.
 */
const ${fileClassName(m)}Service = {};

module.exports = { ${fileClassName(m)}Service };
`,
  'repository.js': (m) =>
    `'use strict';

/**
 * ${m} repository — data access.
 * Queries are centralized here (never directly in controllers).
 * Phase 19 placeholder. Implemented in a later phase.
 * Use the shared Prisma client: const { prisma } = require('../../config/database');
 */
const ${fileClassName(m)}Repository = {};

module.exports = { ${fileClassName(m)}Repository };
`,
  'routes.js': (m) =>
    `'use strict';

const { Router } = require('express');
const { notImplementedRouter } = require('../../routes/notImplemented');

const router = Router();

// Phase 19 placeholder — business logic implemented in a later phase.
router.use(notImplementedRouter('${m}'));

module.exports = { ${camelName(m)}Router: router };
`,
  'validator.js': (m) =>
    `'use strict';

/**
 * ${m} validation schemas (Zod).
 * Phase 19 placeholder. Implemented in a later phase.
 * Use: const { z } = require('zod');
 */
module.exports = {};
`,
  'constants.js': (m) =>
    `'use strict';

/**
 * ${m} module constants.
 * Phase 19 placeholder. Implemented in a later phase.
 */
module.exports = {};
`,
};

function fileClassName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function camelName(name) {
  return name;
}

function scaffold() {
  const modulesDir = path.resolve(__dirname, '..', 'src', 'modules');
  for (const name of MODULES) {
    const dir = path.join(modulesDir, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, template] of Object.entries(FILE_TEMPLATES)) {
      const filePath = path.join(dir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, template(name), 'utf8');
        // eslint-disable-next-line no-console
        console.log(`Created ${path.relative(modulesDir, filePath)}`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log('Module scaffolding complete.');
}

scaffold();
