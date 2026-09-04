'use strict';

const { success, created } = require('../../utils/response');
const { KycService } = require('./service');

const KycController = {
  upload: async (req, res, next) => { try { return created(res, { message: 'KYC document uploaded.', data: await KycService.upload(req.user.sub, req.body, req.file) }); } catch (error) { return next(error); } },
  list: async (req, res, next) => { try { return success(res, { data: await KycService.list(req.user.sub, req.query) }); } catch (error) { return next(error); } },
  get: async (req, res, next) => { try { return success(res, { data: await KycService.get(req.user.sub, req.params.documentId) }); } catch (error) { return next(error); } },
  download: async (req, res, next) => { try { const file = await KycService.download(req.user.sub, req.params.documentId); return res.download(file.path, file.filename); } catch (error) { return next(error); } },
  remove: async (req, res, next) => { try { return success(res, { message: 'KYC document deleted.', data: await KycService.remove(req.user.sub, req.params.documentId) }); } catch (error) { return next(error); } },
  submit: async (req, res, next) => { try { return success(res, { message: 'KYC submitted for review.', data: await KycService.submit(req.user.sub) }); } catch (error) { return next(error); } },
  status: async (req, res, next) => { try { return success(res, { data: await KycService.status(req.user.sub) }); } catch (error) { return next(error); } },
};

module.exports = { KycController };
