'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');

const controller = require('./blackout.controller');

const {
  blackoutCreateSchema,
  blackoutUpdateSchema,
  blackoutListSchema,
  blackoutIdSchema,
} = require('./validator');

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('cars.view'),
  validate({ query: blackoutListSchema }),
  controller.list,
);

router.get(
  '/:id',
  authenticate,
  authorize('cars.view'),
  validate({ params: blackoutIdSchema }),
  controller.get,
);

router.post(
  '/',
  authenticate,
  authorize('cars.update'),
  validate({ body: blackoutCreateSchema }),
  controller.create,
);

router.put(
  '/:id',
  authenticate,
  authorize('cars.update'),
  validate({
    params: blackoutIdSchema,
    body: blackoutUpdateSchema,
  }),
  controller.update,
);

router.delete(
  '/:id',
  authenticate,
  authorize('cars.update'),
  validate({ params: blackoutIdSchema }),
  controller.remove,
);

module.exports = {
  blackoutRouter: router,
};
