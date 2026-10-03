'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { SearchController } = require('./controller');

const router = Router();

router.get(
  '/',
  authenticate,
  SearchController.globalSearch,
);

module.exports = { searchRouter: router };
