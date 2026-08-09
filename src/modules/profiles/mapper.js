'use strict';

/**
 * Profiles mapper — converts Profile rows to safe API DTOs.
 * Re-uses the shared profile mapping from the users module.
 */

const { toProfile } = require('../users/mapper');

module.exports = { toProfile };
