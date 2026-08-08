'use strict';

const { Router } = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { AuthController } = require('./controller');
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
router.post('/login', validate({ body: loginSchema }), AuthController.login);
router.post('/refresh', validate({ body: refreshSchema }), AuthController.refresh);

// Protected routes
router.post('/logout', authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
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
  validate({ body: forgotPasswordSchema }),
  AuthController.forgotPassword,
);
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  AuthController.resetPassword,
);

// Email verification
router.post('/verify-email', validate({ body: verifyEmailSchema }), AuthController.verifyEmail);
router.post(
  '/resend-verification',
  validate({ body: resendVerificationSchema }),
  AuthController.resendVerification,
);

// OTP
router.post('/send-otp', validate({ body: sendOtpSchema }), AuthController.sendOtp);
router.post('/verify-otp', validate({ body: verifyOtpSchema }), AuthController.verifyOtp);

module.exports = { authRouter: router };
