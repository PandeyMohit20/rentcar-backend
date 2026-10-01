'use strict';

const { WalletService } = require('./service');
const { success } = require('../../utils/response');

const WalletController = {
  async getWallet(req, res, next) {
    try {
      const wallet = await WalletService.getWallet(req.user.sub);
      return success(res, {
        message: 'Wallet fetched successfully',
        data: { wallet },
      });
    } catch (err) {
      return next(err);
    }
  },

  async listTransactions(req, res, next) {
    try {
      const result = await WalletService.listTransactions(req.user.sub, req.query);
      return success(res, {
        message: 'Wallet transactions fetched successfully',
        data: { items: result.items },
        meta: result.meta,
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { WalletController };
