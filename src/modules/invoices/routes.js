'use strict';
const { Router } = require('express'); const { authenticate } = require('../../middlewares/authenticate'); const { validate } = require('../../middlewares/validate'); const { InvoicesController } = require('./controller'); const schemas = require('./validator');
const router = Router(); router.get('/:invoiceId', authenticate, validate({ params: schemas.invoiceId }), InvoicesController.getMine); module.exports = { invoicesRouter: router };
