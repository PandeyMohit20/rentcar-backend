'use strict';
const { Router } = require('express'); const { validate } = require('../../middlewares/validate'); const { CustomerAvailabilityController: controller } = require('./controller'); const validator = require('./validator');
const router = Router(); router.post('/search', validate({ body: validator.search }), controller.search); router.post('/check', validate({ body: validator.check }), controller.check);
module.exports = { availabilityRouter: router };
