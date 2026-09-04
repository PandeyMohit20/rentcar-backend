'use strict';
const { Router } = require('express'); const { validate } = require('../../middlewares/validate'); const { QuoteController } = require('./controller'); const { quote } = require('./validator');
const router = Router(); router.post('/quote', validate({ body: quote }), QuoteController.create);
module.exports = { pricingRouter: router };
