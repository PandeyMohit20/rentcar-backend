'use strict';

const { Router } = require('express');
const { notImplementedRouter } = require('../../routes/notImplemented');

const router = Router();

// Phase 19 placeholder — business logic implemented in a later phase.
router.use(notImplementedRouter('locations'));

module.exports = { locationsRouter: router };
