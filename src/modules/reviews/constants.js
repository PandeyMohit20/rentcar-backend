'use strict';

const REVIEW_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'hidden',
]);

const REVIEW_RATINGS = Object.freeze([1, 2, 3, 4, 5]);

module.exports = {
  REVIEW_STATUSES,
  REVIEW_RATINGS,
};
