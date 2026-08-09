'use strict';

const { Router } = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { AddressController } = require('./controller');
const { idParamSchema, createAddressSchema, updateAddressSchema } = require('./validator');

const router = Router();

router.get('/', authenticate, AddressController.listAddresses);
router.post(
  '/',
  authenticate,
  validate({ body: createAddressSchema }),
  AddressController.createAddress,
);
router.get(
  '/:addressId',
  authenticate,
  validate({ params: idParamSchema }),
  AddressController.getAddress,
);
router.patch(
  '/:addressId',
  authenticate,
  validate({ params: idParamSchema, body: updateAddressSchema }),
  AddressController.updateAddress,
);
router.delete(
  '/:addressId',
  authenticate,
  validate({ params: idParamSchema }),
  AddressController.deleteAddress,
);

module.exports = { addressesRouter: router };
