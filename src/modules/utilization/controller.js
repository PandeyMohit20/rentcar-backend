'use strict';

const { success } = require('../../utils/response');
const { UtilizationService } = require('./service');

const UtilizationController = {
  async dashboard(req, res, next) {
    try {
      const data = await UtilizationService.getDashboard(
        req.query,
      );

      return success(res, {
        message: 'Fleet utilization fetched successfully.',
        data,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = {
  UtilizationController,
};