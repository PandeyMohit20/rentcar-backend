'use strict';

const { success } = require('../../utils/response');
const { ReviewsService: service } = require('./service');

const ReviewsController = {
  async create(req, res, next) {
    try {
      return success(res, {
        data: await service.create(
          req.user.sub,
          req.body,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async listMine(req, res, next) {
    try {
      return success(res, {
        data: await service.listMine(
          req.user.sub,
          req.query,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async mySummary(req, res, next) {
    try {
      return success(res, {
        data: await service.mySummary(req.user.sub),
      });
    } catch (error) {
      return next(error);
    }
  },

  async updateMine(req, res, next) {
    try {
      return success(res, {
        data: await service.updateMine(
          req.user.sub,
          req.params.reviewId,
          req.body,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async listForCar(req, res, next) {
    try {
      return success(res, {
        data: await service.listForCar(
          req.params.carId,
          req.query,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      return success(res, {
        data: await service.list(req.query),
      });
    } catch (error) {
      return next(error);
    }
  },

  async detail(req, res, next) {
    try {
      return success(res, {
        data: await service.detail(req.params.reviewId),
      });
    } catch (error) {
      return next(error);
    }
  },

  async approve(req, res, next) {
    try {
      return success(res, {
        data: await service.changeStatus(
          req.user.sub,
          req.params.reviewId,
          'approved',
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async reject(req, res, next) {
    try {
      return success(res, {
        data: await service.changeStatus(
          req.user.sub,
          req.params.reviewId,
          'rejected',
          req.body.reason,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  async hide(req, res, next) {
    try {
      return success(res, {
        data: await service.changeStatus(
          req.user.sub,
          req.params.reviewId,
          'hidden',
        ),
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = { ReviewsController };
