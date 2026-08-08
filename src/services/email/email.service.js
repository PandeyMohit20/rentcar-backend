'use strict';

const { logger } = require('../../config/logger');

/**
 * Email service — abstraction layer for sending emails.
 *
 * This module intentionally does NOT hardcode an SMTP provider. In Phase 20 it
 * provides a pluggable interface with a default no-op/dev implementation that
 * logs the intended email (without sensitive content) so the auth flows can be
 * developed and tested without an external email dependency.
 *
 * To connect a real provider (SendGrid, SES, SMTP, etc.), implement the
 * `send` contract and swap the `transport` here. No auth module code needs to
 * change because all sending goes through this abstraction.
 */

/**
 * @typedef {Object} EmailMessage
 * @property {string} to
 * @property {string} subject
 * @property {string} [html]
 * @property {string} [text]
 * @property {Record<string,any>} [data]  - payload (e.g. OTP, verification link)
 */

/**
 * Default transport: logs the delivery intent only.
 * Never logs OTPs, reset tokens, or verification raw tokens.
 */
async function devTransport(message) {
  logger.info('email:email-scheduled', {
    to: message.to,
    subject: message.subject,
    template: message.template,
    // NOTE: intentionally omit message.data (may contain secrets).
  });
  return { accepted: [message.to] };
}

const transports = {
  dev: devTransport,
};

async function send(message) {
  const transport = transports.dev; // Phase 20 uses the dev transport.
  return transport(message);
}

module.exports = { emailService: { send }, send };
