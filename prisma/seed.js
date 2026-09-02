'use strict';

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const permissionNames = [
  'users.view', 'users.create', 'users.update', 'users.delete', 'users.status.update',
  'users.activate', 'users.deactivate', 'users.suspend', 'users.block',
  'roles.view', 'roles.create', 'roles.update', 'roles.delete', 'roles.status.update',
  'vendors.view', 'vendors.create', 'vendors.update', 'vendors.delete',
  'locations.view', 'locations.create', 'locations.update', 'locations.delete',
  'fleet.view', 'fleet.create', 'fleet.update', 'fleet.delete',
];

async function main() {
  const permissions = await Promise.all(permissionNames.map(async (name) => {
    const [module, action] = name.split(/\.(.+)/);
    return prisma.permission.upsert({ where: { name }, update: { module, action }, create: { name, module, action } });
  }));
  const superAdmin = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: { isSystem: true, isActive: true, status: 'active' },
    create: { name: 'SUPER_ADMIN', description: 'Platform super administrator', isSystem: true, isActive: true, status: 'active' },
  });
  await prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: { isSystem: true }, create: { name: 'CUSTOMER', description: 'Default customer role', isSystem: true } });
  await prisma.role.upsert({ where: { name: 'VENDOR' }, update: { isSystem: true }, create: { name: 'VENDOR', description: 'Vendor role', isSystem: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: superAdmin.id } });
  await prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: superAdmin.id, permissionId: permission.id })), skipDuplicates: true });

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email: email.trim().toLowerCase() },
      update: { status: 'active', emailVerifiedAt: new Date() },
      create: { name: process.env.SEED_ADMIN_NAME || 'Development Admin', email: email.trim().toLowerCase(), passwordHash, status: 'active', emailVerifiedAt: new Date() },
    });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } }, update: {}, create: { userId: user.id, roleId: superAdmin.id } });
  }
}

main().finally(() => prisma.$disconnect());
