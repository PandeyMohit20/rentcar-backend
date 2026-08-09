'use strict';

/**
 * Users mapper — converts Prisma user objects into safe API DTOs.
 * Never serializes passwordHash, refresh tokens, OTP, or internal security
 * fields. These functions are the only place raw user rows are transformed
 * for client consumption.
 */

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Map a profile row to a safe profile DTO. */
function toProfile(profile) {
  if (!profile) return null;
  return {
    verificationStatus: profile.verificationStatus || null,
    dateOfBirth: toIso(profile.dateOfBirth),
    gender: profile.gender || null,
    bio: profile.bio || null,
    profileImage: profile.profileImage || null,
  };
}

/** Map a user row to a safe self-me response DTO. */
function toUserResponse(user, { roles = [], permissions = [], profile = null } = {}) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    status: user.status,
    emailVerifiedAt: toIso(user.emailVerifiedAt),
    lastLoginAt: toIso(user.lastLoginAt),
    createdAt: toIso(user.createdAt),
    updatedAt: toIso(user.updatedAt),
    roles,
    permissions,
    profile: toProfile(profile || user.profile),
  };
}

/** Map a user row to a safe admin-managed details DTO (includes addresses). */
function toUserDetailResponse(
  user,
  { roles = [], permissions = [], profile = null, addresses = [] } = {},
) {
  const base = toUserResponse(user, { roles, permissions, profile });
  return {
    ...base,
    isDeleted: !!user.isDeleted,
    deletedAt: toIso(user.deletedAt),
    addresses: (addresses || []).map((a) => toAddressResponse(a)),
  };
}

/** Map a user row to a compact list item (no sensitive/audit fields). */
function toUserListResponse(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    status: user.status,
    emailVerifiedAt: toIso(user.emailVerifiedAt),
    lastLoginAt: toIso(user.lastLoginAt),
    createdAt: toIso(user.createdAt),
    roles: (user.roles || []).map((ur) => (ur.role && ur.role.name) || ur.name).filter(Boolean),
  };
}

/** Map an address row to a safe address DTO. */
function toAddressResponse(address) {
  if (!address) return null;
  return {
    id: address.id,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || null,
    city: address.city,
    state: address.state || null,
    country: address.country,
    postalCode: address.postalCode || null,
    latitude:
      address.latitude !== null && address.latitude !== undefined ? String(address.latitude) : null,
    longitude:
      address.longitude !== null && address.longitude !== undefined
        ? String(address.longitude)
        : null,
    addressType: address.addressType || 'home',
    isDefault: !!address.isDefault,
    createdAt: toIso(address.createdAt),
    updatedAt: toIso(address.updatedAt),
  };
}

module.exports = {
  toUserResponse,
  toUserDetailResponse,
  toUserListResponse,
  toProfile,
  toAddressResponse,
};
