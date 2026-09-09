'use strict';
const { success } = require('../../utils/response'); const AppError = require('../../errors/AppError'); const httpStatus = require('../../constants/httpStatus'); const errorCodes = require('../../errors/errorCodes'); const service = require('./service');
const missing = () => new AppError('Invoice not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
const InvoicesController = { getMine: async (req, res, next) => { try { const invoice = await service.getMine(req.user.sub, req.params.invoiceId); if (!invoice) throw missing(); return success(res, { data: invoice }); } catch (err) { return next(err); } }, getForBooking: async (req, res, next) => { try { const invoice = await service.getForBooking(req.user.sub, req.params.bookingId); if (!invoice) throw missing(); return success(res, { data: invoice }); } catch (err) { return next(err); } } };
InvoicesController.download = async (req, res, next) => { try {
  const result = await require('./pdf').download(req.params.bookingId, req.user.sub, Boolean(req.invoiceAdmin));
  if (!result) throw missing();
  res.set('Content-Type', 'application/pdf'); res.set('Cache-Control', 'private, no-store');
  res.set('Content-Disposition', `attachment; filename="${result.invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf"`);
  return res.send(result.buffer);
} catch (err) { return next(err); } };
module.exports = { InvoicesController };
