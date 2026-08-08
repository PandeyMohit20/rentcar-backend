'use strict';

/**
 * Date/time utilities. All timestamps are stored/communicated in UTC.
 */

/** Return the current ISO timestamp string. */
function nowISO() {
  return new Date().toISOString();
}

/** Return a Date object shifted by milliseconds. */
function addMilliseconds(ms) {
  return new Date(Date.now() + ms);
}

/** Format a Date or ISO string as an ISO 8601 string. */
function toISOString(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = { nowISO, addMilliseconds, toISOString };
