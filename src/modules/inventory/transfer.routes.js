'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');

const controller = require('./transfer.controller');

const {
  transferCreateSchema,
  transferListSchema,
  transferIdSchema,
  transferVehicleHistorySchema,
} = require('./transfer.validator');

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('cars.view'),
  validate({ query: transferListSchema }),
  controller.list,
);

router.get(
  '/vehicle/:vehicleId/history',
  authenticate,
  authorize('cars.view'),
  validate({ params: transferVehicleHistorySchema }),
  controller.history,
);

router.get(
  '/:id',
  authenticate,
  authorize('cars.view'),
  validate({ params: transferIdSchema }),
  controller.get,
);

router.post(
  '/',
  authenticate,
  authorize('cars.update'),
  validate({ body: transferCreateSchema }),
  controller.create,
);

module.exports = {
  transferRouter: router,
};
