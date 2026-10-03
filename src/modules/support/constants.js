'use strict';

const TICKET_STATUSES = [
  'open',
  'pending',
  'resolved',
  'closed',
  'reopened',
];

const TICKET_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
];

const TICKET_CATEGORIES = [
  'booking',
  'payment',
  'refund',
  'support',
  'technical',
  'other',
];

module.exports = {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
};
