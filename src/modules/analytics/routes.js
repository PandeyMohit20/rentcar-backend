'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { AnalyticsController } = require('./controller');
const { analyticsQuerySchema } = require('./validator');

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('analytics.view'),
  validate({ query: analyticsQuerySchema }),
  AnalyticsController.overview,
);

module.exports = { analyticsRouter: router };
