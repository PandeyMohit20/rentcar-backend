'use strict';
const { prisma } = require('../../config/database');
const { success, created } = require('../../utils/response');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { parsePagination, computeTotalPages } = require('../../utils/pagination');
const missing = () => new AppError('Fleet record not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
async function car(carId) { const value = await prisma.car.findUnique({ where: { id: carId } }); if (!value || value.isDeleted) throw missing(); }
async function record(carId, id) { await car(carId); const value = await prisma.carAvailability.findUnique({ where: { id } }); if (!value || value.carId !== carId) throw missing(); return value; }
function values(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => ['date', 'startTime', 'endTime'].includes(key) && value ? [key, new Date(value)] : [key, value])); }
async function duplicate(carId, date, ignoreId) { const value = await prisma.carAvailability.findFirst({ where: { carId, date: new Date(date) } }); if (value && value.id !== ignoreId) throw new AppError('An availability record already exists for this car and date.', httpStatus.CONFLICT, errorCodes.CONFLICT); }
const AvailabilityController = {
  list: async (req, res, next) => { try { await car(req.params.carId); const { page, limit, offset } = parsePagination(req.query); const where = { carId: req.params.carId, ...(req.query.status ? { status: req.query.status } : {}) }; if (req.query.fromDate || req.query.toDate) where.date = { ...(req.query.fromDate ? { gte: new Date(req.query.fromDate) } : {}), ...(req.query.toDate ? { lte: new Date(req.query.toDate) } : {}) }; const [data, total] = await Promise.all([prisma.carAvailability.findMany({ where, skip: offset, take: limit, orderBy: { date: 'asc' } }), prisma.carAvailability.count({ where })]); return success(res, { message: 'Car availability records fetched successfully.', data, meta: { page, limit, total, totalPages: computeTotalPages(total, limit) } }); } catch (err) { return next(err); } },
  create: async (req, res, next) => { try { await car(req.params.carId); await duplicate(req.params.carId, req.body.date); return created(res, { message: 'Car availability record created successfully.', data: await prisma.carAvailability.create({ data: { carId: req.params.carId, ...values(req.body), startTime: req.body.startTime ? new Date(req.body.startTime) : null, endTime: req.body.endTime ? new Date(req.body.endTime) : null } }) }); } catch (err) { return next(err); } },
  get: async (req, res, next) => { try { return success(res, { message: 'Car availability record fetched successfully.', data: await record(req.params.carId, req.params.availabilityId) }); } catch (err) { return next(err); } },
  update: async (req, res, next) => { try { const current = await record(req.params.carId, req.params.availabilityId); if (req.body.date) await duplicate(req.params.carId, req.body.date, current.id); return success(res, { message: 'Car availability record updated successfully.', data: await prisma.carAvailability.update({ where: { id: current.id }, data: values(req.body) }) }); } catch (err) { return next(err); } },
  remove: async (req, res, next) => { try { await record(req.params.carId, req.params.availabilityId); await prisma.carAvailability.delete({ where: { id: req.params.availabilityId } }); return success(res, { message: 'Car availability record deleted successfully.', data: { success: true } }); } catch (err) { return next(err); } },
};
module.exports = { AvailabilityController };
