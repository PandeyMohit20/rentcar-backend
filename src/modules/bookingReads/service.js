'use strict';

const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');
const { parsePagination, buildMeta, computeTotalPages } = require('../../utils/pagination');
const { hasPermission, isSuperAdmin } = require('../../services/authorization.service');
const repository = require('./repository');
const { listDto, detailDto } = require('./dto');

const notFound = () =>
  new AppError('Booking not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);

function buildWhere(query, vendorIds) {
  const where = {};
  if (vendorIds) {
    where.vendorId = query.vendorId || { in: vendorIds };
  } else if (query.vendorId) {
    where.vendorId = query.vendorId;
  }
  if (query.userId) where.userId = query.userId;
  if (query.carId) where.carId = query.carId;
  if (query.bookingNumber) where.bookingNumber = query.bookingNumber;
  else if (query.search) where.bookingNumber = { contains: query.search };
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.startFrom || query.startTo) {
    where.startAt = {};
    if (query.startFrom) where.startAt.gte = new Date(query.startFrom);
    if (query.startTo) where.startAt.lte = new Date(query.startTo);
  }
  return where;
}

function listOptions(query) {
  const { page, limit, offset } = parsePagination(query);
  return {
    page,
    limit,
    offset,
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder || 'desc',
  };
}

function listResult(result, options, canPickupForVendor) {
  return {
    data: result.bookings.map((booking) =>
      listDto(booking, result.related, canPickupForVendor(booking.vendorId)),
    ),
    meta: buildMeta({
      page: options.page,
      limit: options.limit,
      total: result.total,
      totalPages: computeTotalPages(result.total, options.limit),
    }),
  };
}

async function adminList(user, query) {
  const options = listOptions(query);
  const canOperate = hasPermission(user, 'bookings.operate');
  const membershipIds = canOperate && !isSuperAdmin(user)
    ? await repository.findVendorIdsForUser(user.sub)
    : [];
  const memberSet = new Set(membershipIds);
  const result = await repository.list(buildWhere(query), {
    skip: options.offset,
    take: options.limit,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });
  return listResult(
    result,
    options,
    (vendorId) => canOperate && (isSuperAdmin(user) || memberSet.has(vendorId)),
  );
}

async function vendorScope(user, vendorId) {
  const vendorIds = await repository.findVendorIdsForUser(user.sub);
  if (!vendorId) return vendorIds;
  return vendorIds.includes(vendorId) ? [vendorId] : [];
}

async function vendorList(user, query) {
  const options = listOptions(query);
  const vendorIds = await vendorScope(user, query.vendorId);
  if (vendorIds.length === 0) {
    return listResult(
      { bookings: [], total: 0, related: {} },
      options,
      () => false,
    );
  }
  const result = await repository.list(buildWhere(query, vendorIds), {
    skip: options.offset,
    take: options.limit,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });
  const canOperate = hasPermission(user, 'bookings.operate');
  return listResult(result, options, () => canOperate);
}

async function adminDetail(user, bookingId) {
  const aggregate = await repository.findAdminDetail(bookingId);
  if (!aggregate) throw notFound();
  const canOperate = hasPermission(user, 'bookings.operate');
  let hasPickupScope = isSuperAdmin(user);
  if (canOperate && !hasPickupScope) {
    const vendorIds = await repository.findVendorIdsForUser(user.sub);
    hasPickupScope = vendorIds.includes(aggregate.booking.vendorId);
  }
  return detailDto(aggregate, canOperate && hasPickupScope);
}

async function vendorDetail(user, bookingId) {
  const vendorIds = await repository.findVendorIdsForUser(user.sub);
  if (vendorIds.length === 0) throw notFound();
  const aggregate = await repository.findVendorDetail(bookingId, vendorIds);
  if (!aggregate) throw notFound();
  return detailDto(aggregate, hasPermission(user, 'bookings.operate'));
}

module.exports = { adminList, vendorList, adminDetail, vendorDetail };
