'use strict';

const ReportsService = require('./service');
const { success } = require('../../utils/response');

async function getReport(req, res, next) {
  try {
    const data = await ReportsService.getReport(req.query);

    return success(res, {
      message: 'Report generated successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

const ReportsController = {
  getReport,
};

module.exports = {
  ReportsController,
};
