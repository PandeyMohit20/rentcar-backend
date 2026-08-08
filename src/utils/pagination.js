'use strict';

/**
 * Pagination utilities.
 * Provides safe page/limit parsing and standard metadata generation.
 */

const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

/** Parse and validate page & limit from query params. */
function parsePagination(query = {}) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/** Build standard pagination metadata. */
function buildMeta({ page, limit, total, totalPages }) {
  return {
    page,
    limit,
    total,
    totalPages,
  };
}

/** Compute total pages from total and limit. */
function computeTotalPages(total, limit) {
  return total === 0 ? 0 : Math.ceil(total / limit);
}

module.exports = {
  parsePagination,
  buildMeta,
  computeTotalPages,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
};
