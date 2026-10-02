'use strict';

const { Router } = require('express');

const {
  authenticate,
} = require('../../middlewares/authenticate');

const {
  authorize,
} = require('../../middlewares/authorize');

const {
  validate,
} = require('../../middlewares/validate');

const {
  UtilizationController,
} = require('./controller');

const {
  utilizationQuerySchema,
} = require('./validator');

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('analytics.view'),
  validate({
    query: utilizationQuerySchema,
  }),
  UtilizationController.dashboard,
);

module.exports = {
  utilizationRouter: router,
};