'use strict';

const { success } = require('../../utils/response');
const service = require('./service');

const controller = {
  async adminList(req, res, next) {
    try {
      const result = await service.adminList(req.user, req.query);
      return success(res, {
        message: 'Bookings retrieved successfully.',
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      return next(err);
    }
  },

  async adminDetail(req, res, next) {
    try {
      return success(res, {
        message: 'Booking retrieved successfully.',
        data: await service.adminDetail(req.user, req.params.bookingId),
      });
    } catch (err) {
      return next(err);
    }
  },

  async vendorList(req, res, next) {
    try {
      const result = await service.vendorList(req.user, req.query);
      return success(res, {
        message: 'Bookings retrieved successfully.',
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      return next(err);
    }
  },

  async vendorDetail(req, res, next) {
    try {
      return success(res, {
        message: 'Booking retrieved successfully.',
        data: await service.vendorDetail(req.user, req.params.bookingId),
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { controller };
