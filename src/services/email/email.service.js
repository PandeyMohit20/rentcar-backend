'use strict';

const nodemailer = require('nodemailer');
const { logger } = require('../../config/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function send(message) {
  // Tests exercise auth flows without opening an SMTP connection.
  if (process.env.NODE_ENV === 'test') {
    return { accepted: [message.to], messageId: 'test-email' };
  }
  const mail = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: message.to,
    subject: message.subject,
    text: message.text || buildText(message),
    html: message.html || buildHtml(message),
    attachments: message.attachments || [],
    messageId: message.messageId,
    disableFileAccess: true,
    disableUrlAccess: true,
  };

  try {
    const info = await transporter.sendMail(mail);

    logger.info('email:sent', {
      to: message.to,
      subject: message.subject,
      messageId: info.messageId,
    });

    return {
      accepted: info.accepted,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error('email:send-failed', {
      to: message.to,
      subject: message.subject,
      code: 'EMAIL_SEND_FAILED',
    });

    throw error;
  }
}

function buildText(message) {
  if (message.template === 'email_verification') {
    return `Your RentCar verification OTP is: ${message.data?.otp}

This OTP is valid for a limited time.

If you did not create this account, please ignore this email.`;
  }

  if (message.template === 'otp') {
    return `Your RentCar verification code is: ${message.data?.otp}

This OTP is valid for a limited time.`;
  }

  if (message.template === 'password_reset') {
    return `Your RentCar password reset token is:

${message.data?.token}

If you did not request a password reset, please ignore this email.`;
  }

  return 'This is an automated email from RentCar.';
}

function buildHtml(message) {
  if (message.template === 'email_verification') {
    return `
      <div>
        <h2>Verify your RentCar account</h2>
        <p>Your verification OTP is:</p>
        <h1>${message.data?.otp}</h1>
        <p>This OTP is valid for a limited time.</p>
        <p>If you did not create this account, please ignore this email.</p>
      </div>
    `;
  }

  if (message.template === 'otp') {
    return `
      <div>
        <h2>RentCar Verification Code</h2>
        <p>Your OTP is:</p>
        <h1>${message.data?.otp}</h1>
        <p>This OTP is valid for a limited time.</p>
      </div>
    `;
  }

  if (message.template === 'password_reset') {
    return `
      <div>
        <h2>RentCar Password Reset</h2>
        <p>Your password reset token is:</p>
        <p>${message.data?.token}</p>
      </div>
    `;
  }

  return '<p>This is an automated email from RentCar.</p>';
}

module.exports = {
  emailService: {
    send,
  },
  send,
};
