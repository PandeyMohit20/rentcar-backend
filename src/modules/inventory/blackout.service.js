'use strict';

const repository = require('./blackout.repository');

async function listBlackouts(filters = {}) {
  const records = await repository.findBlackoutRecords(filters);
  let groups = repository.groupRecords(records);

  if (filters.type) {
    groups = groups.filter((item) => item.type === filters.type);
  }

  return groups;
}

async function getBlackout(id) {
  return repository.findBlackoutById(id);
}

async function createBlackout(data) {
  return repository.createBlackout(data);
}

async function updateBlackout(id, data) {
  return repository.updateBlackout(id, data);
}

async function deleteBlackout(id) {
  return repository.deleteBlackout(id);
}

module.exports = {
  listBlackouts,
  getBlackout,
  createBlackout,
  updateBlackout,
  deleteBlackout,
};
