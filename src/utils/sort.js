'use strict';

/**
 * Sorting foundation.
 * Never interpolate user-provided column names into SQL. Only allow
 * whitelisted fields. Returns a safe Prisma `orderBy` object.
 *
 * parseSort(query.sort, ['createdAt', 'price', 'name'])
 *   -> query.sort = "-createdAt" (descending) or "createdAt" (ascending)
 */

function parseSort(sort, allowedFields = []) {
  if (!sort || typeof sort !== 'string') return undefined;
  const allFields = new Set(allowedFields);

  const items = sort
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const orderBy = [];
  for (const item of items) {
    const desc = item.startsWith('-');
    const field = desc ? item.slice(1) : item;
    if (allFields.has(field)) {
      orderBy.push({ [field]: desc ? 'desc' : 'asc' });
    }
  }
  return orderBy.length ? orderBy : undefined;
}

module.exports = { parseSort };
