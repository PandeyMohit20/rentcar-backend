'use strict';

const { success } = require('../../utils/response');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { getMine, listMine } = require('./service');

const RefundsController = {
  getMine: async (req, res, next) => {
    try {
      const refund = await getMine(req.user.sub, req.params.refundId);
      if (!refund) throw new AppError('Refund not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
      return success(res, { data: refund });
    } catch (err) { return next(err); }
  },
  listForBooking: async (req, res, next) => {
    try {
      const refunds = await listMine(req.user.sub, req.params.bookingId);
      if (!refunds) throw new AppError('Booking not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
      return success(res, { data: refunds });
    } catch (err) { return next(err); }
  },
};

module.exports = { RefundsController };
