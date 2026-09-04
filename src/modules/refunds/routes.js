'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { validate } = require('../../middlewares/validate');
const { RefundsController } = require('./controller');
const schemas = require('./validator');

const router = Router();
router.get('/:refundId', authenticate, validate({ params: schemas.refundId }), RefundsController.getMine);

module.exports = { refundsRouter: router };
