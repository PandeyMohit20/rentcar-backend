'use strict';

const { prisma } = require('../../config/database');
const { success, created } = require('../../utils/response');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');

async function getCar(carId) {
  const car = await prisma.car.findUnique({
    where: { id: carId },
  });

  if (!car || car.isDeleted) {
    throw new AppError(
      'Car not found.',
      httpStatus.NOT_FOUND,
      errorCodes.RESOURCE_NOT_FOUND,
    );
  }

  return car;
}

async function getInsurance(carId, insuranceId) {
  await getCar(carId);

  const record = await prisma.carInsurance.findUnique({
    where: { id: insuranceId },
  });

  if (!record || record.carId !== carId) {
    throw new AppError(
      'Insurance record not found.',
      httpStatus.NOT_FOUND,
      errorCodes.RESOURCE_NOT_FOUND,
    );
  }

  return record;
}

async function getMaintenance(carId, maintenanceId) {
  await getCar(carId);

  const record = await prisma.maintenance.findUnique({
    where: { id: maintenanceId },
  });

  if (!record || record.carId !== carId) {
    throw new AppError(
      'Maintenance record not found.',
      httpStatus.NOT_FOUND,
      errorCodes.RESOURCE_NOT_FOUND,
    );
  }

  return record;
}

const controller = {
  listInsurance: async (req, res, next) => {
    try {
      await getCar(req.params.carId);

      const records = await prisma.carInsurance.findMany({
        where: { carId: req.params.carId },
        orderBy: [
          { expiryDate: 'asc' },
          { createdAt: 'desc' },
        ],
      });

      return success(res, {
        message: 'Car insurance records fetched successfully.',
        data: records,
      });
    } catch (e) {
      return next(e);
    }
  },

  createInsurance: async (req, res, next) => {
    try {
      await getCar(req.params.carId);

      const record = await prisma.carInsurance.create({
        data: {
          carId: req.params.carId,
          ...req.body,
          startDate: req.body.startDate
            ? new Date(req.body.startDate)
            : null,
          expiryDate: req.body.expiryDate
            ? new Date(req.body.expiryDate)
            : null,
        },
      });

      return created(res, {
        message: 'Car insurance created successfully.',
        data: record,
      });
    } catch (e) {
      return next(e);
    }
  },

  getInsurance: async (req, res, next) => {
    try {
      return success(res, {
        message: 'Car insurance fetched successfully.',
        data: await getInsurance(
          req.params.carId,
          req.params.insuranceId,
        ),
      });
    } catch (e) {
      return next(e);
    }
  },

  updateInsurance: async (req, res, next) => {
    try {
      await getInsurance(
        req.params.carId,
        req.params.insuranceId,
      );

      const data = {
        ...req.body,
      };

      if (Object.prototype.hasOwnProperty.call(req.body, 'startDate')) {
        data.startDate = req.body.startDate
          ? new Date(req.body.startDate)
          : null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'expiryDate')) {
        data.expiryDate = req.body.expiryDate
          ? new Date(req.body.expiryDate)
          : null;
      }

      const record = await prisma.carInsurance.update({
        where: { id: req.params.insuranceId },
        data,
      });

      return success(res, {
        message: 'Car insurance updated successfully.',
        data: record,
      });
    } catch (e) {
      return next(e);
    }
  },

  deleteInsurance: async (req, res, next) => {
    try {
      const record = await getInsurance(
        req.params.carId,
        req.params.insuranceId,
      );

      await prisma.carInsurance.delete({
        where: { id: record.id },
      });

      return success(res, {
        message: 'Car insurance deleted successfully.',
        data: { success: true },
      });
    } catch (e) {
      return next(e);
    }
  },

  listMaintenance: async (req, res, next) => {
    try {
      await getCar(req.params.carId);

      const records = await prisma.maintenance.findMany({
        where: { carId: req.params.carId },
        orderBy: [
          { scheduledAt: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return success(res, {
        message: 'Maintenance records fetched successfully.',
        data: records,
      });
    } catch (e) {
      return next(e);
    }
  },

  createMaintenance: async (req, res, next) => {
    try {
      await getCar(req.params.carId);

      const data = {
        carId: req.params.carId,
        ...req.body,
      };

      for (const field of ['scheduledAt', 'startedAt', 'completedAt']) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          data[field] = req.body[field]
            ? new Date(req.body[field])
            : null;
        }
      }

      const record = await prisma.maintenance.create({
        data,
      });

      return created(res, {
        message: 'Maintenance record created successfully.',
        data: record,
      });
    } catch (e) {
      return next(e);
    }
  },

  getMaintenance: async (req, res, next) => {
    try {
      return success(res, {
        message: 'Maintenance record fetched successfully.',
        data: await getMaintenance(
          req.params.carId,
          req.params.maintenanceId,
        ),
      });
    } catch (e) {
      return next(e);
    }
  },

  updateMaintenance: async (req, res, next) => {
    try {
      await getMaintenance(
        req.params.carId,
        req.params.maintenanceId,
      );

      const data = {
        ...req.body,
      };

      for (const field of ['scheduledAt', 'startedAt', 'completedAt']) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          data[field] = req.body[field]
            ? new Date(req.body[field])
            : null;
        }
      }

      const record = await prisma.maintenance.update({
        where: { id: req.params.maintenanceId },
        data,
      });

      return success(res, {
        message: 'Maintenance record updated successfully.',
        data: record,
      });
    } catch (e) {
      return next(e);
    }
  },

  deleteMaintenance: async (req, res, next) => {
    try {
      const record = await getMaintenance(
        req.params.carId,
        req.params.maintenanceId,
      );

      await prisma.maintenance.delete({
        where: { id: record.id },
      });

      return success(res, {
        message: 'Maintenance record deleted successfully.',
        data: { success: true },
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = controller;
