'use strict';

const { success } = require('../../utils/response');
const { AnalyticsService } = require('./service');

const AnalyticsController = {
  async overview(req, res, next) {
    try {
      const analytics = await AnalyticsService.getOverview(req.query);

      return success(res, {
        message: 'Analytics fetched successfully.',
        data: analytics,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = { AnalyticsController };
