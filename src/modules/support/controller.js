'use strict';

const { success } = require('../../utils/response');
const { SupportService: service } = require('./service');

const SupportController = {
  async create(req, res, next) {
    try {
      return success(res, {
        data: await service.create(req.user.sub, req.body),
      });
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      return success(res, {
        data: await service.list(req.query),
      });
    } catch (error) {
      return next(error);
    }
  },

  async listMine(req, res, next) {
    try {
      return success(res, {
        data: await service.myTickets(req.user.sub, req.query),
      });
    } catch (error) {
      return next(error);
    }
  },

  async detail(req, res, next) {
    try {
      return success(res, {
        data: await service.detail(req.params.ticketId),
      });
    } catch (error) {
      return next(error);
    }
  },

  async detailMine(req, res, next) {
    try {
      return success(res, {
        data: await service.myDetail(req.params.ticketId, req.user.sub),
      });
    } catch (error) {
      return next(error);
    }
  },

  async messages(req, res, next) {
    try {
      return success(res, {
        data: await service.messages(req.params.ticketId),
      });
    } catch (error) {
      return next(error);
    }
  },

  async messagesMine(req, res, next) {
    try {
      return success(res, {
        data: await service.myMessages(req.params.ticketId, req.user.sub),
      });
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      return success(res, {
        data: await service.update(req.params.ticketId, req.body),
      });
    } catch (error) {
      return next(error);
    }
  },

  async addMessage(req, res, next) {
    try {
      return success(res, {
        data: await service.addMessage(req.params.ticketId, req.user.sub, req.body),
      });
    } catch (error) {
      return next(error);
    }
  },

  async addCustomerMessage(req, res, next) {
    try {
      return success(res, {
        data: await service.addCustomerMessage(req.params.ticketId, req.user.sub, req.body),
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = { SupportController };
