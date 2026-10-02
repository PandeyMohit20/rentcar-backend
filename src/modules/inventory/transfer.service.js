'use strict';

const repository = require('./transfer.repository');

async function listTransfers(filters = {}) {
  return repository.findTransfers(filters);
}

async function getTransfer(id) {
  return repository.findTransferById(id);
}

async function createTransfer(data) {
  return repository.createTransfer(data);
}

async function getTransferHistory(vehicleId, filters = {}) {
  return repository.findTransferHistory(vehicleId, filters);
}

module.exports = {
  listTransfers,
  getTransfer,
  createTransfer,
  getTransferHistory,
};
