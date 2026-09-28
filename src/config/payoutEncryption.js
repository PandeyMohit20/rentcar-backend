'use strict';

const { z } = require('zod');
const AppError = require('../errors/AppError');

// Lazy feature-specific validation; normal application bootstrap loads dotenv.
const keySchema = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
function payoutEncryptionKey() {
  const value = process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY;
  if (keySchema.safeParse(value).success) {
    const key = Buffer.from(value, 'base64');
    if (key.length === 32 && key.toString('base64') === value) return key;
    key.fill(0);
  }
  throw new AppError('Payout destination encryption is unavailable.', 503, 'PAYOUT_ENCRYPTION_UNAVAILABLE');
}

module.exports = { payoutEncryptionKey };
