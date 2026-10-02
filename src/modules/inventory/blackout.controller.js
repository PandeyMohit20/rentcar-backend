'use strict';

const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { success, created } = require('../../utils/response');
const service = require('./blackout.service');

async function list(req, res, next) {
  try {
    const data = await service.listBlackouts(req.query);

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const total = data.length;
    const offset = (page - 1) * limit;

    return success(res, {
      message: 'Blackout dates fetched successfully.',
      data: data.slice(offset, offset + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function get(req, res, next) {
  try {
    const data = await service.getBlackout(req.params.id);

    if (!data) {
      throw new AppError(
        'Blackout not found.',
        httpStatus.NOT_FOUND,
        errorCodes.RESOURCE_NOT_FOUND,
      );
    }

    return success(res, {
      message: 'Blackout date fetched successfully.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await service.createBlackout(req.body);

    return created(res, {
      message: 'Blackout date created successfully.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = await service.updateBlackout(
      req.params.id,
      req.body,
    );

    return success(res, {
      message: 'Blackout date updated successfully.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const data = await service.deleteBlackout(req.params.id);

    return success(res, {
      message: 'Blackout date deleted successfully.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};
