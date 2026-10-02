'use strict';

const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { success, created } = require('../../utils/response');
const service = require('./transfer.service');

async function list(req, res, next) {
  try {
    const data = await service.listTransfers(req.query);

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const total = data.length;
    const offset = (page - 1) * limit;

    return success(res, {
      message: 'Vehicle transfers fetched successfully.',
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
    const data = await service.getTransfer(req.params.id);

    if (!data) {
      throw new AppError(
        'Vehicle transfer not found.',
        httpStatus.NOT_FOUND,
        errorCodes.RESOURCE_NOT_FOUND,
      );
    }

    return success(res, {
      message: 'Vehicle transfer fetched successfully.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await service.createTransfer(req.body);

    return created(res, {
      message: 'Vehicle transferred successfully.',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const data = await service.getTransferHistory(
      req.params.vehicleId,
      req.query,
    );

    return success(res, {
      message: 'Vehicle transfer history fetched successfully.',
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
  history,
};
