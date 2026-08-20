'use strict';

const { prisma } = require('../../config/database');

const roleRepository = {
  async findById(id) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  },

  async findByName(name) {
    return prisma.role.findUnique({
      where: { name },
    });
  },

  async findMany({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } }) {
    return prisma.role.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  },

  async count(where = {}) {
    return prisma.role.count({ where });
  },

  async create(data) {
    return prisma.role.create({
      data,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  },

  async update(id, data) {
    return prisma.role.update({
      where: { id },
      data,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  },

  async delete(id) {
    return prisma.role.delete({
      where: { id },
    });
  },

  async findUserRoleJoinsByRoleId(roleId) {
    return prisma.userRole.findMany({
      where: { roleId },
    });
  },

  async replacePermissions(roleId, permissionIds) {
    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  },
};

module.exports = roleRepository;
