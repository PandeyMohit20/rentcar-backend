'use strict';

const roleRepository = require('./repository');

const roleService = {
  async createRole(data) {
    const existingRole = await roleRepository.findByName(data.name);

    if (existingRole) {
      const error = new Error('Role with this name already exists.');
      error.statusCode = 409;
      throw error;
    }

    const role = await roleRepository.create({
      name: data.name,
      description: data.description ?? null,
      isSystem: false,
      isActive: true,
    });

    return this._setPermissions(role, data.permissions || []);
  },

  async getRoleById(roleId) {
    const role = await roleRepository.findById(roleId);

    if (!role) {
      const error = new Error('Role not found.');
      error.statusCode = 404;
      throw error;
    }

    return this._formatRole(role);
  },

  async listRoles(filters = {}) {
    const {
      search,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where = {};

    if (search) {
      where.name = {
        contains: search,
      };
    }

    if (status) {
      where.status = status;
    }

    const allowedSortFields = [
      'name',
      'createdAt',
      'updatedAt',
      'status',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    const [roles, total] = await Promise.all([
      roleRepository.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [safeSortBy]: safeSortOrder,
        },
      }),
      roleRepository.count(where),
    ]);

    return {
      data: roles.map((role) => this._formatRole(role)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateRole(roleId, data) {
    const existingRole = await roleRepository.findById(roleId);

    if (!existingRole) {
      const error = new Error('Role not found.');
      error.statusCode = 404;
      throw error;
    }

    if (existingRole.isSystem) {
      const error = new Error('System role cannot be modified.');
      error.statusCode = 403;
      throw error;
    }

    if (data.name && data.name !== existingRole.name) {
      const roleWithSameName = await roleRepository.findByName(data.name);

      if (roleWithSameName && roleWithSameName.id !== roleId) {
        const error = new Error('Role with this name already exists.');
        error.statusCode = 409;
        throw error;
      }
    }

    const updateData = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    const role = await roleRepository.update(roleId, updateData);

    if (data.permissions !== undefined) {
      return this._setPermissions(role, data.permissions);
    }

    return this._formatRole(role);
  },

  async updateStatus(roleId, status) {
    const existingRole = await roleRepository.findById(roleId);

    if (!existingRole) {
      const error = new Error('Role not found.');
      error.statusCode = 404;
      throw error;
    }

    if (existingRole.isSystem) {
      const error = new Error('System role status cannot be changed.');
      error.statusCode = 403;
      throw error;
    }

    const role = await roleRepository.update(roleId, {
      status,
      isActive: status === 'active',
    });

    return this._formatRole(role);
  },

  async deleteRole(roleId) {
    const existingRole = await roleRepository.findById(roleId);

    if (!existingRole) {
      const error = new Error('Role not found.');
      error.statusCode = 404;
      throw error;
    }

    if (existingRole.isSystem) {
      const error = new Error('System role cannot be deleted.');
      error.statusCode = 403;
      throw error;
    }

    const assignedUsers = await roleRepository.findUserRoleJoinsByRoleId(roleId);

    if (assignedUsers.length > 0) {
      const error = new Error(
        'Role cannot be deleted because it is assigned to users.',
      );
      error.statusCode = 409;
      throw error;
    }

    await roleRepository.delete(roleId);

    return {
      message: 'Role deleted successfully.',
    };
  },

  async _setPermissions(role, permissions) {
    if (!permissions.length) {
      return this._formatRole(role);
    }

    const { prisma } = require('../../config/database');

    const permissionIds = [];

    for (const permission of permissions) {
      for (const action of permission.actions) {
        const existingPermission = await prisma.permission.findUnique({
          where: {
            module_action: {
              module: permission.module,
              action,
            },
          },
        });

        if (existingPermission) {
          permissionIds.push(existingPermission.id);
        }
      }
    }

    const updatedRole = await roleRepository.replacePermissions(
      role.id,
      permissionIds,
    );

    return this._formatRole(updatedRole);
  },

  _formatRole(role) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      status: role.status,
      permissions: (role.permissions || []).map((item) => ({
        id: item.permission.id,
        name: item.permission.name,
        module: item.permission.module,
        action: item.permission.action,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  },
};

module.exports = roleService;
