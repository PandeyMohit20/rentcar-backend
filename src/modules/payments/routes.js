'use strict';
const { Router } = require('express'); const { authenticate } = require('../../middlewares/authenticate'); const { validate } = require('../../middlewares/validate'); const { PaymentsController } = require('./controller'); const schemas = require('./validator');
const router = Router();
router.post('/orders', authenticate, validate({ body: schemas.order }), PaymentsController.createOrder);
router.post('/verify', authenticate, validate({ body: schemas.verify }), PaymentsController.verify);
router.post('/webhook/razorpay', PaymentsController.webhook);
router.get('/:paymentId', authenticate, validate({ params: schemas.paymentId }), PaymentsController.get);
module.exports = { paymentsRouter: router };
