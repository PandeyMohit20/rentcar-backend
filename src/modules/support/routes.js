'use strict';

const { Router } = require('express');

const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');

const { SupportController: controller } = require('./controller');

const {
  idParams,
  listQuery,
  createTicketBody,
  updateTicketBody,
  createMessageBody,
} = require('./validator');

const router = Router();

const customerAuth = [authenticate];

const supportView = [authenticate, authorize('support.view')];

const supportManage = [authenticate, authorize('support.manage')];

// ========================================================
// CUSTOMER - CREATE TICKET
// ========================================================

router.post(
  '/',
  ...customerAuth,
  validate({
    body: createTicketBody,
  }),
  controller.create,
);

// ========================================================
// CUSTOMER - MY TICKETS
// IMPORTANT: These routes must stay BEFORE /:ticketId
// ========================================================

router.get(
  '/my-tickets',
  ...customerAuth,
  validate({
    query: listQuery,
  }),
  controller.listMine,
);

router.get(
  '/my-tickets/:ticketId/messages',
  ...customerAuth,
  validate({
    params: idParams,
  }),
  controller.messagesMine,
);

router.get(
  '/my-tickets/:ticketId',
  ...customerAuth,
  validate({
    params: idParams,
  }),
  controller.detailMine,
);

router.post(
  '/my-tickets/:ticketId/messages',
  ...customerAuth,
  validate({
    params: idParams,
    body: createMessageBody,
  }),
  controller.addCustomerMessage,
);

// ========================================================
// ADMIN - SUPPORT
// ========================================================

router.get(
  '/',
  ...supportView,
  validate({
    query: listQuery,
  }),
  controller.list,
);

router.get(
  '/:ticketId/messages',
  ...supportView,
  validate({
    params: idParams,
  }),
  controller.messages,
);

router.get(
  '/:ticketId',
  ...supportView,
  validate({
    params: idParams,
  }),
  controller.detail,
);

router.patch(
  '/:ticketId',
  ...supportManage,
  validate({
    params: idParams,
    body: updateTicketBody,
  }),
  controller.update,
);

router.post(
  '/:ticketId/messages',
  ...supportManage,
  validate({
    params: idParams,
    body: createMessageBody,
  }),
  controller.addMessage,
);

module.exports = { supportRouter: router };
