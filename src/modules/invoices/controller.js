'use strict';
const { success } = require('../../utils/response'); const AppError = require('../../errors/AppError'); const httpStatus = require('../../constants/httpStatus'); const errorCodes = require('../../errors/errorCodes'); const service = require('./service');
const missing = () => new AppError('Invoice not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
const InvoicesController = { getMine: async (req, res, next) => { try { const invoice = await service.getMine(req.user.sub, req.params.invoiceId); if (!invoice) throw missing(); return success(res, { data: invoice }); } catch (err) { return next(err); } }, getForBooking: async (req, res, next) => { try { const invoice = await service.getForBooking(req.user.sub, req.params.bookingId); if (!invoice) throw missing(); return success(res, { data: invoice }); } catch (err) { return next(err); } } };
module.exports = { InvoicesController };
