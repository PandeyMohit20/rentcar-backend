// It's only one day thanks messages at the same mobileso we can hello special rule so physics producers have to a battery of three lakhs five lakhs seven lakhs for I say one lakh so please contact please contact please contact softly roti khlomato it loveta shit lovka night started him chavalti plan to channel condenser twelve marketcala no heals walk mat legal no pching somebattle ethics material body materials sticker mager, so it is far lick to plays north no picture hebs subsequent health licket phiching rope magnos a sticker uda,no current market nosuch in a play came in camera, might some platform drive, barrier, shit

// const { logger } = require('../../config/logger');

// /**
//  * Email service — abstraction layer for sending emails.
//  *
//  * This module intentionally does NOT hardcode an SMTP provider. In Phase 20 it
//  * provides a pluggable interface with a default no-op/dev implementation that
//  * logs the intended email (without sensitive content) so the auth flows can be
//  * developed and tested without an external email dependency.
//  *
//  * To connect a real provider (SendGrid, SES, SMTP, etc.), implement the
//  * `send` contract and swap the `transport` here. No auth module code needs to
//  * change because all sending goes through this abstraction.
//  */

// /**
//  * @typedef {Object} EmailMessage
//  * @property {string} to
//  * @property {string} subject
//  * @property {string} [html]
//  * @property {string} [text]
//  * @property {Record<string,any>} [data]  - payload (e.g. OTP, verification link)
//  */

// /**
//  * Default transport: logs the delivery intent only.
//  * Never logs OTPs, reset tokens, or verification raw tokens.
//  */
// async function devTransport(message) {
//   logger.info('email:email-scheduled', {
//     to: message.to,
//     subject: message.subject,
//     template: message.template,
//     // NOTE: intentionally omit message.data (may contain secrets).
//   });
//   return { accepted: [message.to] };
// }

// const transports = {
//   dev: devTransport,
// };

// async function send(message) {
//   const transport = transports.dev; // Phase 20 uses the dev transport.
//   return transport(message);
// }

// module.exports = { emailService: { send }, send };



'use strict'

const nodemailer = require('nodemailer')
const { logger } = require('../../config/logger')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

/**
 * Build email content from the template and data.
 */
function buildEmail(message) {
  if (message.template === 'email_verification') {
    const otp = message.data?.otp

    return {
      text: `Your email verification code is ${otp}. This code will expire soon.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>Verify your email</h2>

          <p>Thank you for creating an account with RentCar.</p>

          <p>Your email verification code is:</p>

          <div
            style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              margin: 24px 0;
            "
          >
            ${otp}
          </div>

          <p>Please enter this code in the application to verify your email.</p>

          <p>This code will expire soon.</p>

          <p>Thanks,<br />RentCar Team</p>
        </div>
      `,
    }
  }

  return {
    text: message.text || '',
    html: message.html || '',
  }
}

/**
 * Send an email through Gmail SMTP.
 */
async function send(message) {
  try {
    const content = buildEmail(message)

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: message.to,
      subject: message.subject,
      text: content.text,
      html: content.html,
    })

    logger.info('email:sent', {
      to: message.to,
      subject: message.subject,
      messageId: info.messageId,
    })

    return {
      accepted: info.accepted,
      rejected: info.rejected,
      messageId: info.messageId,
    }
  } catch (error) {
    logger.error('email:send-failed', {
      to: message.to,
      subject: message.subject,
      error: error.message,
    })

    throw error
  }
}

module.exports = {
  emailService: {
    send,
  },
  send,
}