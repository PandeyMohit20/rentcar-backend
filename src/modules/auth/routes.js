'use strict';

const { Router } = require('express');
const { notImplementedRouter } = require('../../routes/notImplemented');

const router = Router();

// Phase 19: authentication foundation only.
// Full login/register/refresh exists in Phase 20.
// Mount a 501 placeholder so the route is registered and documented.
router.use(notImplementedRouter('auth'));

module.exports = { authRouter: router };
