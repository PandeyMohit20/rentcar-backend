'use strict';

const { z } = require('zod');
const { validatePassword, PASSWORD_POLICY } = require('./password.policy');
const { CLIENT_OTP_PURPOSES } = require('./constants');

/**
 * Email normalization: trim + lowercase.
 */
const emailField = z
  .string({ required_error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .email('Invalid email address.')
  .max(255);

/**
 * Phone: normalize by trimming. Digits, +, spaces, hyphens, parentheses.
 * The service applies a consistent normalization strategy before lookup/storage.
 */
const phoneField = z
  .string()
  .trim()
  .max(50)
  .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number.')
  .optional();

/**
 * Password schema that enforces the centralized password policy.
 */
const passwordField = z
  .string()
  .max(PASSWORD_POLICY.MAX_LENGTH)
  .superRefine((val, ctx) => {
    const result = validatePassword(val);
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.errors.join(' '),
      });
    }
  });

const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required.' }).trim().min(2).max(255),
  email: emailField,
  phone: phoneField,
  password: passwordField,
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required.' }).trim().toLowerCase().email().max(255),
  password: z.string({ required_error: 'Password is required.' }).min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordField,
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordField,
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255).optional(),
});

const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  phone: phoneField,
  purpose: z.enum(CLIENT_OTP_PURPOSES),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  phone: phoneField,
  purpose: z.enum(CLIENT_OTP_PURPOSES),
  otp: z.string().min(4).max(8),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  sendOtpSchema,
  verifyOtpSchema,
};
