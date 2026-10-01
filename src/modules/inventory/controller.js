'use strict';

const InventoryService = require('./service');
const { success } = require('../../utils/response');

async function list(req, res, next) {
  try {
    const data = await InventoryService.listInventory(req.query);

    return success(res, {
      message: 'Inventory fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function stats(req, res, next) {
  try {
    const data = await InventoryService.getStats();

    return success(res, {
      message: 'Inventory statistics fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function calendar(req, res, next) {
  try {
    const data = await InventoryService.getCalendar(req.query);

    return success(res, {
      message: 'Inventory calendar fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

const InventoryController = {
  list,
  stats,
  calendar,
};

module.exports = {
  InventoryController,
};
