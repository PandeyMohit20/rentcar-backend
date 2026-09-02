'use strict';

const { AuthService } = require('./service');
const { success, created } = require('../../utils/response');
const { COOKIE_NAMES, SESSION_TTL_MS } = require('./constants');
const { cookieOptions } = require('./auth.utils');

/**
 * Auth controller — thin request handlers.
 * All business logic lives in AuthService. Controllers only translate
 * HTTP requests/responses and manage the refresh-token cookie.
 */

function setRefreshCookie(res, refreshToken, maxAgeMs) {
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, cookieOptions({ maxAgeMs }));
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAMES.REFRESH, cookieOptions());
}

const AuthController = {
  // POST /api/v1/auth/register
  async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body, req);
      return created(res, { message: 'Registration successful', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/login
  async login(req, res, next) {
    try {
      const result = await AuthService.login(req.body, req);

      // Refresh token delivered via secure HttpOnly cookie.
      setRefreshCookie(res, result.refreshToken, cookieOptions().maxAge || SESSION_TTL_MS);

      return success(res, {
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          sessionId: result.sessionId,
          expiresAt: result.expiresAt,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/refresh
  async refresh(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies[COOKIE_NAMES.REFRESH];
      const result = await AuthService.refresh(refreshToken, req);

      setRefreshCookie(res, result.refreshToken, cookieOptions().maxAge || SESSION_TTL_MS);

      return success(res, {
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          sessionId: result.sessionId,
          expiresAt: result.expiresAt,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/logout
  async logout(req, res, next) {
    try {
      const result = await AuthService.logout(
        { userId: req.user.sub, sessionId: req.user.sessionId },
        req,
      );
      clearRefreshCookie(res);
      return success(res, { message: 'Logged out successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/logout-all
  async logoutAll(req, res, next) {
    try {
      const result = await AuthService.logoutAll(req.user.sub, req);
      clearRefreshCookie(res);
      return success(res, { message: 'Logged out of all devices', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/v1/auth/me
  async me(req, res, next) {
    try {
      const user = await AuthService.getCurrentUser(req.user.sub);
      return success(res, { message: 'Current user', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/change-password
  async changePassword(req, res, next) {
    try {
      const result = await AuthService.changePassword(
        { userId: req.user.sub, ...req.body },
        { ...req, sessionId: req.user.sessionId },
      );
      return success(res, { message: 'Password changed successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/forgot-password
  async forgotPassword(req, res, next) {
    try {
      const result = await AuthService.forgotPassword(req.body, req);
      return success(res, { message: result.message, data: {} });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/reset-password
  async resetPassword(req, res, next) {
    try {
      const result = await AuthService.resetPassword(req.body, req);
      return success(res, { message: 'Password has been reset', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/verify-email
  async verifyEmail(req, res, next) {
    try {
      const result = await AuthService.verifyEmail(req.body, req);
      return success(res, { message: 'Email verified successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/resend-verification
  async resendVerification(req, res, next) {
    try {
      const result = await AuthService.resendVerification(req.body, req);
      return success(res, { message: result.message, data: {} });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/send-otp
  async sendOtp(req, res, next) {
    try {
      const result = await AuthService.sendOtp(req.body, req);
      return success(res, { message: result.message, data: {} });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/v1/auth/verify-otp
  async verifyOtp(req, res, next) {
    try {
      const result = await AuthService.verifyOtp(req.body, req);
      return success(res, { message: 'OTP verified successfully', data: result });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = { AuthController };
