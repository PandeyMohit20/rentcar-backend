'use strict';

const { Router } = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { authenticateTokenOnly } = require('../../middlewares/authenticate');
const { AuthController } = require('./controller');
const { authRateLimit } = require('../../middlewares/authRateLimit');
const {
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
} = require('./validator');

const router = Router();

// Public routes
router.post('/register', validate({ body: registerSchema }), AuthController.register);
router.post('/login', authRateLimit(), validate({ body: loginSchema }), AuthController.login);
router.post('/refresh', validate({ body: refreshSchema }), AuthController.refresh);

// Protected routes. Logout uses token-only auth so it is idempotent even
// after the session has been revoked by a previous logout.
router.post('/logout', authenticateTokenOnly, AuthController.logout);
router.post('/logout-all', authenticateTokenOnly, AuthController.logoutAll);
router.get('/me', authenticate, AuthController.me);

// Password management
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  AuthController.changePassword,
);
router.post(
  '/forgot-password',
  authRateLimit(),
  validate({ body: forgotPasswordSchema }),
  AuthController.forgotPassword,
);
router.post(
  '/reset-password',
  authRateLimit(),
  validate({ body: resetPasswordSchema }),
  AuthController.resetPassword,
);

// Email verification
router.post('/verify-email', validate({ body: verifyEmailSchema }), AuthController.verifyEmail);
router.post(
  '/resend-verification',
  authRateLimit(),
  validate({ body: resendVerificationSchema }),
  AuthController.resendVerification,
);

// OTP
router.post('/send-otp', authRateLimit(), validate({ body: sendOtpSchema }), AuthController.sendOtp);
router.post('/verify-otp', authRateLimit(), validate({ body: verifyOtpSchema }), AuthController.verifyOtp);

module.exports = { authRouter: router };
