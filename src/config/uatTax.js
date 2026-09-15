'use strict';
const { env } = require('./env');
function isUatTaxBypass(config = env) {
  return config.NODE_ENV !== 'production' && config.BYPASS_TAX_APPROVAL_FOR_UAT === 'true';
}
module.exports = { isUatTaxBypass };
