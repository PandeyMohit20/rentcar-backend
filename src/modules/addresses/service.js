'use strict';

const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');
const { AddressRepository } = require('./repository');
const { toAddressResponse } = require('../users/mapper');
const { logger } = require('../../config/logger');

function getClientInfo(req) {
  return {
    ipAddress: req.ip || req.ipAddress || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.requestId || null,
  };
}

async function emitEvent(userId, action, ctx, metadata = {}, opts = {}) {
  try {
    await require('../users/repository').UsersRepository.logAudit({
      userId,
      action,
      module: 'addresses',
      entity: opts.entity,
      entityId: opts.entityId,
      result: opts.result || 'success',
      metadata,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    logger.warn('Failed to write address audit log', { code: 'AUDIT_LOG_FAILED' });
  }
}

function normalizeCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = typeof value === 'string' ? value.trim() : value;
  const numberValue = Number(normalized);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function normalizeAddressInput(data) {
  const normalized = {};

  if (data.addressLine1 !== undefined) normalized.addressLine1 = String(data.addressLine1).trim();
  if (data.addressLine2 !== undefined)
    normalized.addressLine2 = String(data.addressLine2).trim() || null;
  if (data.city !== undefined) normalized.city = String(data.city).trim();
  if (data.state !== undefined) normalized.state = String(data.state).trim() || null;
  if (data.country !== undefined) normalized.country = String(data.country).trim();
  if (data.postalCode !== undefined) normalized.postalCode = String(data.postalCode).trim() || null;
  if (data.latitude !== undefined) normalized.latitude = normalizeCoordinate(data.latitude);
  if (data.longitude !== undefined) normalized.longitude = normalizeCoordinate(data.longitude);
  if (data.addressType !== undefined) normalized.addressType = String(data.addressType).trim();
  if (Object.prototype.hasOwnProperty.call(data, 'isDefault')) {
    normalized.isDefault = data.isDefault === true;
  }

  return normalized;
}

async function ensureOwnership(userId, address) {
  if (!address) {
    throw new AppError('Address not found.', httpStatus.NOT_FOUND, errorCodes.ADDRESS_NOT_FOUND);
  }
  if (address.userId !== userId) {
    throw new AppError(
      'Address access forbidden.',
      httpStatus.FORBIDDEN,
      errorCodes.ADDRESS_FORBIDDEN,
    );
  }
}

const AddressService = {
  async listAddresses(userId) {
    const addresses = await AddressRepository.findAddressesByUserId(userId);
    return addresses.map(toAddressResponse);
  },

  async getAddress(userId, addressId) {
    const address = await AddressRepository.findAddressById(addressId);
    await ensureOwnership(userId, address);
    return toAddressResponse(address);
  },

  async createAddress(userId, data, req) {
    const ctx = getClientInfo(req);
    const addressData = normalizeAddressInput(data);
    if (addressData.isDefault) {
      await AddressRepository.unsetDefaultAddress(userId);
    } else {
      const existing = await AddressRepository.findAddressesByUserId(userId);
      if (existing.length === 0) {
        addressData.isDefault = true;
      }
    }

    const created = await AddressRepository.createAddress(userId, addressData);
    await emitEvent(
      userId,
      'address.created',
      ctx,
      {},
      { entity: 'address', entityId: created.id },
    );
    return toAddressResponse(created);
  },

  async updateAddress(userId, addressId, data, req) {
    const ctx = getClientInfo(req);
    const address = await AddressRepository.findAddressById(addressId);
    await ensureOwnership(userId, address);
    const updateData = normalizeAddressInput(data);
    if (updateData.isDefault) {
      await AddressRepository.unsetDefaultAddress(userId);
    }
    const updated = await AddressRepository.updateAddress(addressId, updateData);
    await emitEvent(userId, 'address.updated', ctx, {}, { entity: 'address', entityId: addressId });
    return toAddressResponse(updated);
  },

  async deleteAddress(userId, addressId, req) {
    const ctx = getClientInfo(req);
    const address = await AddressRepository.findAddressById(addressId);
    await ensureOwnership(userId, address);
    await AddressRepository.deleteAddress(addressId);
    await emitEvent(userId, 'address.deleted', ctx, {}, { entity: 'address', entityId: addressId });
    return { success: true };
  },
};

module.exports = { AddressService };
