'use strict';

const { prisma } = require('../../config/database');
const { success, created } = require('../../utils/response');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');

const config = {
  City: {
    delegate: 'city',
    key: 'cityId',
    list: 'listCities',
  },
  Location: {
    delegate: 'location',
    key: 'locationId',
    list: 'listLocations',
  },
  Branch: {
    delegate: 'branch',
    key: 'branchId',
    list: 'listBranches',
  },
};

async function find(type, value, activeOnly = false) {
  const record = await prisma[config[type].delegate].findUnique({
    where: {
      id: value,
    },
  });

  if (
    !record ||
    record.isDeleted ||
    (activeOnly && record.status !== 'active')
  ) {
    throw new AppError(
      `${type} not found.`,
      httpStatus.NOT_FOUND,
      errorCodes.RESOURCE_NOT_FOUND,
    );
  }

  return record;
}

function attach(type) {
  const { delegate, key, list } = config[type];

  // ============================================================
  // LIST
  // ============================================================

  exports[list] = async (req, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const where = {
        isDeleted: false,
      };

      // Status is optional.
      // Without status filter -> show all non-deleted records.
      if (req.query.status) {
        where.status = req.query.status;
      }

      if (req.query.search) {
        where.name = {
          contains: req.query.search,
        };
      }

      if (type === 'Location' && req.query.cityId) {
        where.cityId = req.query.cityId;
      }

      const [data, total] = await Promise.all([
        prisma[delegate].findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: {
            name: 'asc',
          },
        }),

        prisma[delegate].count({
          where,
        }),
      ]);

      return success(res, {
        message: `${type}s fetched successfully.`,
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (e) {
      return next(e);
    }
  };

  // ============================================================
  // GET BY ID
  // ============================================================

  exports[`get${type}`] = async (req, res, next) => {
    try {
      return success(res, {
        message: `${type} fetched successfully.`,
        data: await find(type, req.params[key], false),
      });
    } catch (e) {
      return next(e);
    }
  };

  // ============================================================
  // CREATE
  // ============================================================

  exports[`create${type}`] = async (req, res, next) => {
    try {
      return created(res, {
        message: `${type} created successfully.`,
        data: await prisma[delegate].create({
          data: req.body,
        }),
      });
    } catch (e) {
      return next(e);
    }
  };

  // ============================================================
  // UPDATE
  // ============================================================

  exports[`update${type}`] = async (req, res, next) => {
    try {
      await find(type, req.params[key]);

      return success(res, {
        message: `${type} updated successfully.`,
        data: await prisma[delegate].update({
          where: {
            id: req.params[key],
          },
          data: req.body,
        }),
      });
    } catch (e) {
      return next(e);
    }
  };

  // ============================================================
  // DELETE - SOFT DELETE
  // ============================================================

  exports[`delete${type}`] = async (req, res, next) => {
    try {
      await find(type, req.params[key]);

      await prisma[delegate].update({
        where: {
          id: req.params[key],
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          status: 'inactive',
        },
      });

      return success(res, {
        message: `${type} deleted successfully.`,
        data: {
          success: true,
        },
      });
    } catch (e) {
      return next(e);
    }
  };
}

Object.keys(config).forEach(attach);