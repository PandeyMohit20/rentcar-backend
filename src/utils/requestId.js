'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Generate a UUID request ID.
 */
function generateRequestId() {
  return uuidv4();
}

module.exports = { generateRequestId };
