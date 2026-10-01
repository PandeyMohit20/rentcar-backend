'use strict';

const { Router } = require('express');

const { InventoryController } = require('./controller');

const { inventoryQuerySchema, calendarQuerySchema } = require('./validator');

const { authenticate } = require('../../middlewares/authenticate');

const { authorize } = require('../../middlewares/authorize');

const { validate } = require('../../middlewares/validate');

const router = Router();

router.get('/stats', authenticate, authorize('cars.view'), InventoryController.stats);

router.get(
  '/calendar',
  authenticate,
  authorize('cars.view'),
  validate({
    query: calendarQuerySchema,
  }),
  InventoryController.calendar,
);

router.get(
  '/',
  authenticate,
  authorize('cars.view'),
  validate({
    query: inventoryQuerySchema,
  }),
  InventoryController.list,
);

module.exports = {
  inventoryRouter: router,
};
