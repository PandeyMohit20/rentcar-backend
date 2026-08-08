'use strict';

const { Router } = require('express');
const { health, databaseHealth } = require('./health.controller');

const router = Router();

// GET /api/v1/health
router.get('/', health);

// GET /api/v1/health/database
router.get('/database', databaseHealth);

module.exports = { healthRouter: router };
