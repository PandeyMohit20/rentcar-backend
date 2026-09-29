'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { validate } = require('../../middlewares/validate');
const { WalletController } = require('./controller');
const { transactionsQuerySchema } = require('./validator');

const router = Router();

router.get('/', authenticate, WalletController.getWallet);

router.get(
  '/transactions',
  authenticate,
  validate({ query: transactionsQuerySchema }),
  WalletController.listTransactions,
);

module.exports = { walletRouter: router };
