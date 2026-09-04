'use strict';
const { prisma } = require('../../config/database');
const { success, created } = require('../../utils/response');
const AppError = require('../../errors/AppError');
const httpStatus = require('../../constants/httpStatus');
const errorCodes = require('../../errors/errorCodes');
const { parsePagination, computeTotalPages } = require('../../utils/pagination');
const missing = () => new AppError('Fleet record not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
async function car(carId) { const value = await prisma.car.findUnique({ where: { id: carId } }); if (!value || value.isDeleted) throw missing(); }
async function record(carId, id) { await car(carId); const value = await prisma.carPricing.findUnique({ where: { id } }); if (!value || value.carId !== carId) throw missing(); return value; }
function dates(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => ['effectiveFrom', 'effectiveTo'].includes(key) && value ? [key, new Date(value)] : [key, value])); }
const PricingController = {
  list: async (req, res, next) => { try { await car(req.params.carId); const { page, limit, offset } = parsePagination(req.query); const where = { carId: req.params.carId, ...(req.query.status ? { status: req.query.status } : {}) }; const [data, total] = await Promise.all([prisma.carPricing.findMany({ where, skip: offset, take: limit, orderBy: { effectiveFrom: 'desc' } }), prisma.carPricing.count({ where })]); return success(res, { message: 'Car pricing records fetched successfully.', data, meta: { page, limit, total, totalPages: computeTotalPages(total, limit) } }); } catch (err) { return next(err); } },
  create: async (req, res, next) => { try { await car(req.params.carId); return created(res, { message: 'Car pricing record created successfully.', data: await prisma.carPricing.create({ data: { carId: req.params.carId, ...dates(req.body) } }) }); } catch (err) { return next(err); } },
  get: async (req, res, next) => { try { return success(res, { message: 'Car pricing record fetched successfully.', data: await record(req.params.carId, req.params.pricingId) }); } catch (err) { return next(err); } },
  update: async (req, res, next) => { try { await record(req.params.carId, req.params.pricingId); return success(res, { message: 'Car pricing record updated successfully.', data: await prisma.carPricing.update({ where: { id: req.params.pricingId }, data: dates(req.body) }) }); } catch (err) { return next(err); } },
  remove: async (req, res, next) => { try { await record(req.params.carId, req.params.pricingId); await prisma.carPricing.delete({ where: { id: req.params.pricingId } }); return success(res, { message: 'Car pricing record deleted successfully.', data: { success: true } }); } catch (err) { return next(err); } },
};
const { createTrustedQuote } = require('./service');
const QuoteController = { create: async (req, res, next) => { try { return created(res, { message: 'Trusted pricing quote created successfully.', data: await createTrustedQuote(req.body) }); } catch (err) { return next(err); } } };
module.exports = { PricingController, QuoteController };
