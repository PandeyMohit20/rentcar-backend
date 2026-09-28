'use strict';
const { Router } = require('express'); const { validate } = require('../../middlewares/validate'); const { QuoteController } = require('./controller'); const { quote } = require('./validator');
const { authenticate } = require('../../middlewares/authenticate');
const optionalAuth = (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next();
const router = Router(); router.post('/quote', optionalAuth, validate({ body: quote }), QuoteController.create);
module.exports = { pricingRouter: router };
