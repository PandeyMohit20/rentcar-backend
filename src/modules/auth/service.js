// It's only one day thanks messages at the same mobileso we can hello special rule so physics producers have to a battery of three lakhs five lakhs seven lakhs for I say one lakh so please contact please contact please contact'use strict';
'use strict';

const { prisma } = require('../../config/database');
const AppError = require('../../errors/AppError');
const errorCodes = require('../../errors/errorCodes');
const httpStatus = require('../../constants/httpStatus');
const { DEFAULT_ROLE_NAME } = require('../../constants/roles');
const { hashPassword, comparePassword } = require('../../utils/password');
const { signAccessToken, verifyRefreshToken } = require('../../utils/jwt');
const { logger } = require('../../config/logger');
const { emailService } = require('../../services/email/email.service');
const { AuthRepository } = require('./repository');
const {
  USER_STATUS,
  OTP_PURPOSE,
  AUTH_EVENTS,
  OTP_CONFIG,
  VERIFICATION_TTL_MS,
  RESET_TOKEN_TTL_MS,
  SESSION_TTL_MS,
} = require('./constants');
const {
  hashSecret,
  randomToken,
  generateOtp,
  hashOtp,
  durationToMs,
  serializeUser,
} = require('./auth.utils');

/**
 * Auth service — authentication & authorization business logic.
 * All database access goes through AuthRepository; all password hashing goes
 * through the password utils; all token signing goes through jwt utils.
 */

const genericAuthError = () =>
  new AppError(
    'Invalid email or password.',
    httpStatus.UNAUTHORIZED,
    errorCodes.AUTH_INVALID_CREDENTIALS,
  );

const genericResetResponse = 'If the account exists, password reset instructions have been sent.';

/** Normalize email: trim + lowercase. */
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * Normalize phone: strip spaces, hyphens, parentheses for consistent
 * uniqueness. The business rule treats these as equivalent.
 */
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone)
    .replace(/[\s\-()]/g, '')
    .trim();
}

function getClientInfo(req) {
  return {
    ipAddress: req.ip || req.ipAddress || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.requestId || null,
  };
}

async function emitEvent(userId, event, ctx, result = null) {
  try {
    await AuthRepository.logAudit({
      userId,
      action: event,
      result,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    logger.warn('Failed to write audit log', { code: 'AUDIT_LOG_FAILED' });
  }
}

/** Load a user's roles + permissions for JWT payload and response. */
async function loadAuthContext(userId) {
  const { roles: roleNames, permissions } = await AuthRepository.findUserPermissions(userId);
  return { roles: roleNames, permissions };
}

/** Issue fresh access + refresh tokens and persist the refresh token hash. */
async function issueTokenPair(user, { sessionId }) {
  const ctx = await loadAuthContext(user.id);

  const accessToken = signAccessToken({
    sub: user.id,
    role: ctx.roles[0] || DEFAULT_ROLE_NAME,
    sessionId,
    type: 'access',
  });

  const refreshToken = randomToken(48);
  const refreshTokenHash = hashSecret(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + durationToMs('7d'));

  await AuthRepository.createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: refreshExpiresAt,
  });

  return {
    accessToken,
    refreshToken,
    expiresAt: refreshExpiresAt,
    roles: ctx.roles,
    permissions: ctx.permissions,
  };
}

const AuthService = {
  // ---- REGISTER ----
  async register(data, req) {
    const email = normalizeEmail(data.email);
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const ctx = getClientInfo(req);

    // Duplicate email check.
    const existingEmail = await AuthRepository.findUserByEmail(email);
    if (existingEmail) {
      throw new AppError(
        'An account with this email already exists.',
        httpStatus.CONFLICT,
        errorCodes.AUTH_EMAIL_EXISTS,
      );
    }

    // Duplicate phone check (if provided).
    if (phone) {
      const existingPhone = await AuthRepository.findUserByPhone(phone);
      if (existingPhone) {
        throw new AppError(
          'An account with this phone number already exists.',
          httpStatus.CONFLICT,
          errorCodes.AUTH_PHONE_EXISTS,
        );
      }
    }

    const passwordHash = await hashPassword(data.password);

    // Transactional registration: user + profile + role + verification state.
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone,
          name: data.name.trim(),
          passwordHash,
          status: USER_STATUS.PENDING,
        },
      });

      await tx.profile.create({
        data: { userId: user.id },
      });

      // Assign default CUSTOMER role.
      let role = await tx.role.findUnique({ where: { name: DEFAULT_ROLE_NAME } });
      if (!role) {
        role = await tx.role.create({
          data: { name: DEFAULT_ROLE_NAME, description: 'Default customer role', isSystem: true },
        });
      }
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });

      return user;
    });

    // Create an email verification OTP foundation.
  try {
  console.log('📧 REGISTER: creating verification OTP');

  const otp = generateOtp(OTP_CONFIG.LENGTH);

  console.log('📧 REGISTER: OTP generated');

  await AuthRepository.createOtp({
    userId: result.id,
    purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
    codeHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  console.log('📧 REGISTER: OTP saved to database');

  await emailService.send({
    to: result.email,
    subject: 'Verify your RentCar account',
    template: 'email_verification',
    data: { otp },
  });

  console.log('📧 REGISTER: emailService.send() completed');
} catch (err) {
  console.error('❌ REGISTER EMAIL ERROR:', err);
  logger.warn('Registration verification email skipped', {
    code: 'EMAIL_SEND_FAILED', , came to me,camps deletes no cancelcame receptive trying invoice in a student one forty five six one zero six requests, charges last class, starting down started automatic rights paper fifty six starts process dispatch cancels tax total tax local payments joins in payments, kissty three options, list setting I started my rock. Sixty five ID six forty three fruit online requirements transdictional zero nine eight human charter ships promotion four seven hundred seventy shops, like my set of study, applied next hips, recently systic system, is a million of payments from matters four hundred. One hundred fifty seven thousand raised requester, black receipt, automatic tricky dispatchlow shina complete completelybarriers, recouncils consulations, collections payment adjusted gold,collections gate IT modern create kons in front of retailautomatic barzlong speed session. Receiva, where so different different papers receipts collectionstanding amount for a standard percent bars down in baking pleasant, few sables, facility charges ina comment request, alonga selected Italian tabled setting shot change, stock learners.
    error: err.message,
  });
}

    await emitEvent(result.id, AUTH_EVENTS.REGISTER_SUCCESS, ctx, 'success');

    const safeUser = serializeUser(result, { roles: [DEFAULT_ROLE_NAME], permissions: [] });
    return { user: safeUser };
  },

  // ---- LOGIN ----
  async login(data, req) {
    const email = normalizeEmail(data.email);
    const ctx = getClientInfo(req);

    const user = await AuthRepository.findUserByEmail(email);

    // Generic error — never reveal whether the email exists.
    if (!user) {
      await emitEvent(null, AUTH_EVENTS.LOGIN_FAILED, ctx, 'fail');
      throw genericAuthError();
    }

    // Account status validation.
    if (user.status !== USER_STATUS.ACTIVE) {
      await emitEvent(user.id, AUTH_EVENTS.LOGIN_FAILED, ctx, 'fail');
      if (user.status === USER_STATUS.BLOCKED) {
        throw new AppError(
          'This account has been blocked.',
          httpStatus.FORBIDDEN,
          errorCodes.AUTH_ACCOUNT_BLOCKED,
        );
      }
      if (user.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
          'This account has been suspended.',
          httpStatus.FORBIDDEN,
          errorCodes.AUTH_ACCOUNT_SUSPENDED,
        );
      }
      if (user.status === USER_STATUS.INACTIVE || user.status === USER_STATUS.PENDING) {
        throw new AppError(
          'This account is not active.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_ACCOUNT_INACTIVE,
        );
      }
      throw new AppError(
        'This account cannot log in.',
        httpStatus.FORBIDDEN,
        errorCodes.AUTH_ACCOUNT_DISABLED,
      );
    }

    const passwordOk = await comparePassword(data.password, user.passwordHash);
    if (!passwordOk) {
      await emitEvent(user.id, AUTH_EVENTS.LOGIN_FAILED, ctx, 'fail');
      throw genericAuthError();
    }

    // Create a session.
    const sessionToken = randomToken(32);
    const sessionTokenHash = hashSecret(sessionToken);
    const session = await AuthRepository.createSession({
      userId: user.id,
      sessionTokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    // Update lastLoginAt.
    await AuthRepository.updateLastLogin(user.id);

    // Issue token pair.
    const tokens = await issueTokenPair(user, { sessionId: session.id });

    await emitEvent(user.id, AUTH_EVENTS.LOGIN_SUCCESS, ctx, 'success');

    const ctx2 = await loadAuthContext(user.id);
    const safeUser = serializeUser(user, {
      roles: ctx2.roles,
      permissions: ctx2.permissions,
      profile: (await AuthRepository.findUserWithProfile(user.id))?.profile || null,
    });
    safeUser.lastLoginAt = new Date().toISOString();

    return {
      user: safeUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId: session.id,
      expiresAt: tokens.expiresAt,
    };
  },

  // ---- REFRESH (rotation) ----
  async refresh(refreshToken, req) {
    const ctx = getClientInfo(req);

    if (!refreshToken) {
      throw new AppError(
        'Refresh token is required.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_UNAUTHORIZED,
      );
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(
        'Invalid refresh token.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_TOKEN_INVALID,
      );
    }

    const tokenHash = hashSecret(refreshToken);
    const stored = await AuthRepository.findRefreshTokenByHash(tokenHash);

    // Old token reuse detection: valid JWT but no stored hash => already rotated/revoked.
    if (!stored) {
      // Revoke the session associated with this token (reuse).
      if (payload.sessionId) {
        await AuthRepository.revokeSession(payload.sessionId).catch(() => {});
      }
      await emitEvent(payload.sub, AUTH_EVENTS.REFRESH_TOKEN_REUSE_DETECTED, ctx, 'fail');
      throw new AppError(
        'Refresh token has been reused.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_REFRESH_TOKEN_REUSE,
      );
    }

    if (stored.revokedAt) {
      // Distinguish reuse from a plain revoked token: if a newer refresh token
      // exists for this user (created after this token was revoked), the
      // presented token was rotated and its reuse is a compromise indicator.
      const newer = await AuthRepository.findNewerRefreshTokenForUser(
        payload.sub,
        stored.revokedAt,
      );
      if (newer) {
        // Reuse detected — revoke the session and report reuse.
        await AuthRepository.revokeSession(payload.sessionId).catch(() => {});
        await emitEvent(payload.sub, AUTH_EVENTS.REFRESH_TOKEN_REUSE_DETECTED, ctx, 'fail');
        throw new AppError(
          'Refresh token has been reused.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_REFRESH_TOKEN_REUSE,
        );
      }
      await AuthRepository.revokeSession(payload.sessionId).catch(() => {});
      await emitEvent(payload.sub, AUTH_EVENTS.REFRESH_TOKEN_REUSE_DETECTED, ctx, 'fail');
      throw new AppError(
        'Refresh token has been revoked.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_REFRESH_TOKEN_REVOKED,
      );
    }

    if (new Date(stored.expiresAt) < new Date()) {
      throw new AppError(
        'Refresh token has expired.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_TOKEN_EXPIRED,
      );
    }

    // User must still be active.
    const user = await AuthRepository.findUserById(payload.sub);
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      throw new AppError(
        'Authentication required.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_UNAUTHORIZED,
      );
    }

    // Session must be valid.
    if (payload.sessionId) {
      const session = await AuthRepository.findSessionById(payload.sessionId);
      if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
        throw new AppError(
          'Session is no longer valid.',
          httpStatus.UNAUTHORIZED,
          errorCodes.AUTH_SESSION_INVALID,
        );
      }
    }

    // Atomic rotation: revoke old, create new.
    const newTokens = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const newRefresh = randomToken(48);
      const newHash = hashSecret(newRefresh);
      const newExpiresAt = new Date(Date.now() + durationToMs('7d'));

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newHash,
          expiresAt: newExpiresAt,
        },
      });

      const ctxNow = await loadAuthContext(user.id);
      const accessToken = signAccessToken({
        sub: user.id,
        role: ctxNow.roles[0] || DEFAULT_ROLE_NAME,
        sessionId: payload.sessionId || null,
        type: 'access',
      });

      return { accessToken, refreshToken: newRefresh, expiresAt: newExpiresAt };
    });

    await emitEvent(user.id, AUTH_EVENTS.REFRESH_TOKEN_ROTATED, ctx, 'success');

    return { ...newTokens, sessionId: payload.sessionId || null };
  },

  // ---- LOGOUT ----
  async logout({ userId, sessionId }, req) {
    const ctx = getClientInfo(req);

    // Idempotent: revoke session + its refresh tokens if they exist.
    if (sessionId) {
      await AuthRepository.revokeSession(sessionId).catch(() => {});
      // Revoke refresh tokens for this user (session-scoped is not available in schema).
      await AuthRepository.revokeAllRefreshTokensForUser(userId).catch(() => {});
    }
    await emitEvent(userId, AUTH_EVENTS.LOGOUT, ctx, 'success');
    return { success: true };
  },

  // ---- LOGOUT ALL ----
  async logoutAll(userId, req) {
    const ctx = getClientInfo(req);
    await AuthRepository.revokeAllSessionsForUser(userId);
    await AuthRepository.revokeAllRefreshTokensForUser(userId);
    await emitEvent(userId, AUTH_EVENTS.LOGOUT_ALL, ctx, 'success');
    return { success: true };
  },

  // ---- ME ----
  async getCurrentUser(userId) {
    const user = await AuthRepository.findUserWithProfile(userId);
    if (!user) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
    }
    const ctx = await loadAuthContext(userId);
    return serializeUser(user, {
      roles: ctx.roles,
      permissions: ctx.permissions,
      profile: user.profile || null,
    });
  },

  // ---- CHANGE PASSWORD ----
  async changePassword({ userId, currentPassword, newPassword }, req) {
    const ctx = getClientInfo(req);
    const user = await AuthRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found.', httpStatus.NOT_FOUND, errorCodes.RESOURCE_NOT_FOUND);
    }

    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError(
        'Current password is incorrect.',
        httpStatus.UNAUTHORIZED,
        errorCodes.AUTH_PASSWORD_INVALID,
      );
    }

    const newHash = await hashPassword(newPassword);
    await AuthRepository.updateUserPassword(userId, newHash);

    // Revoke all other sessions (keep current session active per policy).
    await AuthRepository.revokeAllSessionsForUser(userId);
    if (req?.sessionId) {
      // Re-create current session to keep it active.
      await AuthRepository.createSession({
        userId,
        sessionTokenHash: hashSecret(randomToken(32)),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
    await AuthRepository.revokeAllRefreshTokensForUser(userId);

    await emitEvent(userId, AUTH_EVENTS.PASSWORD_CHANGED, ctx, 'success');
    return { success: true };
  },

  // ---- FORGOT PASSWORD ----
  async forgotPassword({ email }, _req) {
    const normalized = normalizeEmail(email);
    const user = await AuthRepository.findUserByEmail(normalized);

    // Always return the same generic response — no account enumeration.
    if (user) {
      const resetToken = randomToken(32);
      await AuthRepository.createOtp({
        userId: user.id,
        purpose: OTP_PURPOSE.PASSWORD_RESET,
        codeHash: hashSecret(resetToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      await emailService.send({
        to: user.email,
        subject: 'Password reset',
        template: 'password_reset',
        data: { token: resetToken },
      });
    }
    return { message: genericResetResponse };
  },

  // ---- RESET PASSWORD ----
  async resetPassword({ token, newPassword }, req) {
    const ctx = getClientInfo(req);
    const tokenHash = hashSecret(token);

    const otpRecord = await prisma.otp.findFirst({
      where: { codeHash: tokenHash, purpose: OTP_PURPOSE.PASSWORD_RESET },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(
        'Invalid or expired reset token.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_RESET_TOKEN_INVALID,
      );
    }
    if (otpRecord.verifiedAt) {
      throw new AppError(
        'Reset token has already been used.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_RESET_TOKEN_INVALID,
      );
    }
    if (new Date(otpRecord.expiresAt) < new Date()) {
      throw new AppError(
        'Reset token has expired.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_RESET_TOKEN_EXPIRED,
      );
    }

    const newHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: otpRecord.userId },
        data: { passwordHash: newHash },
      });
      await tx.otp.update({
        where: { id: otpRecord.id },
        data: { verifiedAt: new Date() },
      });
      // Revoke all sessions + refresh tokens after password reset.
      await tx.session.updateMany({
        where: { userId: otpRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: otpRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await emitEvent(otpRecord.userId, AUTH_EVENTS.PASSWORD_RESET, ctx, 'success');
    return { success: true };
  },

  // ---- EMAIL VERIFICATION ----
  async verifyEmail({ token }, req) {
    const ctx = getClientInfo(req);
    const tokenHash = hashSecret(token);
    const otpRecord = await prisma.otp.findFirst({
      where: { codeHash: tokenHash, purpose: OTP_PURPOSE.EMAIL_VERIFICATION },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(
        'Invalid or expired verification token.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_VERIFICATION_TOKEN_INVALID,
      );
    }
    if (otpRecord.verifiedAt) {
      throw new AppError(
        'Email is already verified.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_EMAIL_NOT_VERIFIED,
      );
    }
    if (new Date(otpRecord.expiresAt) < new Date()) {
      throw new AppError(
        'Verification token has expired.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_VERIFICATION_TOKEN_INVALID,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: otpRecord.userId },
        data: { emailVerifiedAt: new Date(), status: USER_STATUS.ACTIVE },
      });
      await tx.otp.update({
        where: { id: otpRecord.id },
        data: { verifiedAt: new Date() },
      });
    });

    await emitEvent(otpRecord.userId, AUTH_EVENTS.EMAIL_VERIFIED, ctx, 'success');
    return { success: true };
  },

  async resendVerification({ email }, _req) {
    const normalized = normalizeEmail(email);
    const user = await AuthRepository.findUserByEmail(normalized);

    // Generic response regardless of whether the account exists.
    if (user && !user.emailVerifiedAt) {
      const otp = generateOtp(OTP_CONFIG.LENGTH);
      await AuthRepository.createOtp({
        userId: user.id,
        purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
        codeHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      });
      await emailService.send({
        to: user.email,
        subject: 'Verify your email',
        template: 'email_verification',
        data: { otp },
      });
    }
    return {
      message: 'If the email exists and is unverified, a verification message has been sent.',
    };
  },

  // ---- OTP ----
  async sendOtp({ email, phone, purpose }, req) {
    const ctx = getClientInfo(req);
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    let user = null;
    if (normalizedEmail) user = await AuthRepository.findUserByEmail(normalizedEmail);
    if (!user && normalizedPhone) user = await AuthRepository.findUserByPhone(normalizedPhone);

    // Generic response — do not reveal whether the account exists.
    if (user) {
      const otp = generateOtp(OTP_CONFIG.LENGTH);
      await AuthRepository.createOtp({
        userId: user.id,
        purpose,
        codeHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_CONFIG.TTL_MS),
      });
      await emailService.send({
        to: user.email,
        subject: 'Your verification code',
        template: 'otp',
        data: { otp, purpose },
      });
      await emitEvent(user.id, AUTH_EVENTS.OTP_SENT, ctx, 'success');
    }
    return { message: 'If the account exists, an OTP has been sent.' };
  },

  async verifyOtp({ email, phone, purpose, otp }, req) {
    const ctx = getClientInfo(req);
    const normalizedEmail = email ? normalizeEmail(email) : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    let user = null;
    if (normalizedEmail) user = await AuthRepository.findUserByEmail(normalizedEmail);
    if (!user && normalizedPhone) user = await AuthRepository.findUserByPhone(normalizedPhone);

    if (!user) {
      throw new AppError('Invalid OTP.', httpStatus.BAD_REQUEST, errorCodes.AUTH_OTP_INVALID);
    }

    const otpRecord = await AuthRepository.findLatestOtp(user.id, purpose);
    if (!otpRecord) {
      throw new AppError('Invalid OTP.', httpStatus.BAD_REQUEST, errorCodes.AUTH_OTP_INVALID);
    }
    if (otpRecord.verifiedAt) {
      throw new AppError(
        'OTP has already been used.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_OTP_INVALID,
      );
    }
    if (otpRecord.attemptCount >= OTP_CONFIG.MAX_ATTEMPTS) {
      throw new AppError(
        'Too many attempts. Please request a new OTP.',
        httpStatus.BAD_REQUEST,
        errorCodes.AUTH_OTP_MAX_ATTEMPTS,
      );
    }
    if (new Date(otpRecord.expiresAt) < new Date()) {
      throw new AppError('OTP has expired.', httpStatus.BAD_REQUEST, errorCodes.AUTH_OTP_EXPIRED);
    }

    const otpHash = hashOtp(otp);
    if (otpHash !== otpRecord.codeHash) {
      await AuthRepository.incrementOtpAttempts(otpRecord.id);
      await emitEvent(user.id, AUTH_EVENTS.OTP_FAILED, ctx, 'fail');
      throw new AppError('Invalid OTP.', httpStatus.BAD_REQUEST, errorCodes.AUTH_OTP_INVALID);
    }

    await AuthRepository.markOtpVerified(otpRecord.id);

    // Purpose-specific side effects.
    if (purpose === OTP_PURPOSE.EMAIL_VERIFICATION) {
      await AuthRepository.markEmailVerified(user.id).catch(() => {});
      await prisma.user
        .update({ where: { id: user.id }, data: { status: USER_STATUS.ACTIVE } })
        .catch(() => {});
    }

    await emitEvent(user.id, AUTH_EVENTS.OTP_VERIFIED, ctx, 'success');
    return { success: true, purpose };
  },
};

module.exports = { AuthService };
