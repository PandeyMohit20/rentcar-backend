'use strict';

const { AddressService } = require('./service');
const { success } = require('../../utils/response');

const AddressController = {
  async listAddresses(req, res, next) {
    try {
      const addresses = await AddressService.listAddresses(req.user.sub);
      return success(res, { message: 'Addresses fetched successfully', data: { addresses } });
    } catch (err) {
      return next(err);
    }
  },

  async getAddress(req, res, next) {
    try {
      const address = await AddressService.getAddress(req.user.sub, req.params.addressId);
      return success(res, { message: 'Address fetched successfully', data: { address } });
    } catch (err) {
      return next(err);
    }
  },

  async createAddress(req, res, next) {
    try {
      const address = await AddressService.createAddress(req.user.sub, req.body, req);
      return success(res, { message: 'Address created successfully', data: { address } });
    } catch (err) {
      return next(err);
    }
  },

  async updateAddress(req, res, next) {
    try {
      const address = await AddressService.updateAddress(
        req.user.sub,
        req.params.addressId,
        req.body,
        req,
      );
      return success(res, { message: 'Address updated successfully', data: { address } });
    } catch (err) {
      return next(err);
    }
  },

  async deleteAddress(req, res, next) {
    try {
      const result = await AddressService.deleteAddress(req.user.sub, req.params.addressId, req);
      return success(res, { message: 'Address deleted successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { AddressController };
