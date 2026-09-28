'use strict';

const { settlementPreviewSchema } = require('./validator');
const { readPreviewCandidates } = require('./settlementRepository');
const { evaluateSettlementEligibility, summarizePreview } = require('./settlementEligibility');

async function previewVendorSettlements(user, vendorId, filters = {}) {
  const query = settlementPreviewSchema.parse(filters);
  const { candidates, total, observedAt } = await readPreviewCandidates(user, vendorId, query);
  const bookings = candidates.map((candidate) => evaluateSettlementEligibility(candidate, vendorId));
  return {
    data: { observedAt, generationReady: bookings.length > 0 && bookings.every((b) => b.generationReady),
      netPayable: bookings.length > 0 && bookings.every((b) => b.generationReady)
        ? require('./settlementPolicy').money(bookings.reduce((sum, b) => sum + require('./settlementPolicy').minor(b.netPayable), 0n)) : null, bookings,
      summary: { scope: 'page', inclusion: 'eligibleForReview', byCurrency: summarizePreview(bookings) } },
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

module.exports = { previewVendorSettlements };
