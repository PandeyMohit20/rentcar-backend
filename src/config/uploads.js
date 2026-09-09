'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
// Test cleanup must never share storage with a running development application.
const uploadRoot =
  process.env.NODE_ENV === 'test'
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'rentcar-test-uploads-'))
    : path.join(process.cwd(), 'uploads');
module.exports = { uploadRoot };
