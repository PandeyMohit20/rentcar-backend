'use strict';

const { prisma } = require('../../config/database');

const AddressRepository = {
  async findAddressById(id) {
    return prisma.address.findUnique({ where: { id } });
  },

  async findAddressesByUserId(userId) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async createAddress(userId, data) {
    return prisma.address.create({ data: { userId, ...data } });
  },

  async updateAddress(id, data) {
    return prisma.address.update({ where: { id }, data });
  },

  async deleteAddress(id) {
    return prisma.address.delete({ where: { id } });
  },

  async unsetDefaultAddress(userId) {
    return prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  },
};

module.exports = { AddressRepository };
