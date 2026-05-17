/**
 * Authentication Routes
 * Login, register, logout, refresh token, password management
 */

import { Router, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { asyncHandler, authRateLimiter, protect, passwordResetRateLimiter, emailValidation, passwordValidation } from '../middleware';
import User from '../models/User';
import config from '../config';
import { logSecurityEvent } from '../utils/logger';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/email';
import { generateTOTPSecret, generateTOTPUri, verifyTOTP } from '../utils/totp';

const router = Router();

/**
 * Generate JWT tokens
 */
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { id: userId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn as any }
  );

  return { accessToken, refreshToken };
};

/**
 * Set cookies with tokens
 */
const setTokenCookies = (res: any, accessToken: string, refreshToken: string) => {
  // Access token cookie (short-lived)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: config.server.isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Refresh token cookie (long-lived)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.server.isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Clear token cookies
 */
const clearTokenCookies = (res: any) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('XSRF-TOKEN');
};

// ===========================================
// Public Routes (with rate limiting)
// ===========================================

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', authRateLimiter, emailValidation, passwordValidation, asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'An account with this email already exists.',
    });
  }

  // Create user
  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    csrfSecret: crypto.randomBytes(32).toString('hex'),
  });

  // Send email verification (fire-and-forget)
  try {
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
    await User.findByIdAndUpdate(user._id, {
      emailVerificationToken: hashedVerifyToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hrs
    });
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`;
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (_e) {
    // Non-blocking — user can still use the account
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id.toString());

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Set cookies
  setTokenCookies(res, accessToken, refreshToken);

  logSecurityEvent('User registered', { userId: user._id, email });

  return res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
      },
    },
  });
}));

/**
 * POST /api/auth/login
 * Login user — if 2FA enabled, returns twoFactorRequired=true
 */
router.post('/login', authRateLimiter, emailValidation, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password +twoFactorSecret');

  if (!user) {
    logSecurityEvent('Login attempt - user not found', { email, ip: req.ip }, 'warn');
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  // Check if account is locked
  if (user.isLocked()) {
    logSecurityEvent('Login attempt - account locked', { userId: user._id, email }, 'warn');
    return res.status(423).json({
      success: false,
      message: 'Account temporarily locked due to multiple failed attempts. Please try again later.',
    });
  }

  // Check if user is active
  if (!user.isActive) {
    logSecurityEvent('Login attempt - inactive account', { userId: user._id, email }, 'warn');
    return res.status(401).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support.',
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.loginAttempts = 0;
      logSecurityEvent('Account locked - too many failed attempts', { userId: user._id, email }, 'warn');
    }
    await user.save();
    logSecurityEvent('Login attempt - invalid password', { userId: user._id, email }, 'warn');
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  // Reset login attempts
  user.loginAttempts = 0;
  user.lockUntil = undefined;

  // If 2FA is enabled, issue a short-lived pending token instead of full JWTs
  if (user.twoFactorEnabled) {
    user.lastLogin = new Date();
    await user.save();

    const tfToken = jwt.sign(
      { id: user._id.toString(), twoFactorPending: true },
      config.jwt.secret,
      { expiresIn: '5m' }
    );
    res.cookie('tfToken', tfToken, {
      httpOnly: true,
      secure: config.server.isProduction,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    logSecurityEvent('Login - 2FA required', { userId: user._id, email });
    return res.json({
      success: true,
      twoFactorRequired: true,
      message: 'Please enter your two-factor authentication code.',
    });
  }

  user.lastLogin = new Date();
  await user.save();

  const { accessToken, refreshToken } = generateTokens(user._id.toString());
  user.refreshToken = refreshToken;
  await user.save();
  setTokenCookies(res, accessToken, refreshToken);

  logSecurityEvent('User logged in', { userId: user._id, email });

  return res.json({
    success: true,
    message: 'Login successful.',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        headline: user.headline,
        profilePicture: user.profilePicture,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    },
  });
}));

// ===========================================
// Protected Routes
// ===========================================

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', protect, asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: undefined,
    });

    logSecurityEvent('User logged out', { userId: req.user.id });
  }

  clearTokenCookies(res);

  return res.json({
    success: true,
    message: 'Logout successful.',
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token not found.',
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

    // Find user and verify refresh token matches
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      logSecurityEvent('Refresh token mismatch', { userId: decoded.id }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token.',
      });
    }

    // Check if user is still active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated.',
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id.toString());

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set new cookies
    setTokenCookies(res, accessToken, newRefreshToken);

    return res.json({
      success: true,
      message: 'Token refreshed successfully.',
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token.',
    });
  }
}));

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', protect, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?.id).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  return res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        headline: user.headline,
        location: user.location,
        profilePicture: user.profilePicture,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        settings: user.settings,
        followers: user.followers.length,
        following: user.following.length,
        connections: user.connections.length,
      },
    },
  });
}));

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', authRateLimiter, passwordResetRateLimiter, emailValidation, asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
    logSecurityEvent('Password reset email sent', { userId: user._id, email });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({ success: false, message: 'Could not send email. Try again later.' });
  }

  return res.json({
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  });
}));

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', authRateLimiter, passwordValidation, asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Reset token is required.' });
  }

  const hashedToken = crypto.createHash('sha256').update(token as string).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
  }

  user.password = password as string;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  // Reset lockout if any
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  logSecurityEvent('Password reset completed', { userId: user._id });

  return res.json({
    success: true,
    message: 'Password reset successfully. Please log in.',
  });
}));

// ===========================================
// Two-Factor Authentication Routes
// ===========================================

/**
 * POST /api/auth/2fa/validate
 * Second step of login when 2FA is enabled
 */
router.post('/2fa/validate', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const tfToken = req.cookies.tfToken;
  const { code } = req.body;

  if (!tfToken) {
    return res.status(401).json({ success: false, message: 'No pending 2FA session.' });
  }
  if (!code) {
    return res.status(400).json({ success: false, message: 'Verification code is required.' });
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(tfToken, config.jwt.secret) as JwtPayload;
  } catch {
    res.clearCookie('tfToken');
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }

  if (!decoded.twoFactorPending) {
    return res.status(401).json({ success: false, message: 'Invalid session type.' });
  }

  const user = await User.findById(decoded.id).select('+twoFactorSecret +twoFactorBackupCodes');
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found.' });
  }

  // Verify TOTP code
  const isValid = verifyTOTP(String(code), user.twoFactorSecret!);

  // Also check backup codes
  let usedBackupCode = false;
  if (!isValid && user.twoFactorBackupCodes) {
    const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    const idx = user.twoFactorBackupCodes.indexOf(codeHash);
    if (idx !== -1) {
      user.twoFactorBackupCodes.splice(idx, 1);
      await user.save();
      usedBackupCode = true;
    }
  }

  if (!isValid && !usedBackupCode) {
    logSecurityEvent('2FA validation failed', { userId: user._id }, 'warn');
    return res.status(401).json({ success: false, message: 'Invalid verification code.' });
  }

  res.clearCookie('tfToken');

  const { accessToken, refreshToken } = generateTokens(user._id.toString());
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save();
  setTokenCookies(res, accessToken, refreshToken);

  logSecurityEvent('User logged in with 2FA', { userId: user._id });

  return res.json({
    success: true,
    message: 'Login successful.',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        headline: user.headline,
        profilePicture: user.profilePicture,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    },
  });
}));

/**
 * GET /api/auth/2fa/setup
 * Generate a TOTP secret + QR code for the logged-in user.
 * - Normal call: returns same secret if within 10-min window, else regenerates.
 * - ?force=true: always regenerates (used by frontend 60s auto-refresh so QR actually changes).
 * Once 2FA is enabled, returns 400 permanently.
 */
router.get('/2fa/setup', protect, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select('+twoFactorSecret +twoFactorSetupExpiry');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  if (user.twoFactorEnabled) {
    return res.status(400).json({ success: false, message: '2FA is already enabled on this account.' });
  }

  const SETUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  const forceNew = req.query.force === 'true';

  const hasValidSecret =
    !forceNew &&
    user.twoFactorSecret &&
    user.twoFactorSetupExpiry &&
    user.twoFactorSetupExpiry.getTime() > now;

  let secret: string;
  let isNew = false;

  if (hasValidSecret) {
    // Reuse existing secret within the window
    secret = user.twoFactorSecret!;
  } else {
    // Generate fresh secret — reset the 10-min window
    secret = generateTOTPSecret();
    isNew = true;
    await User.findByIdAndUpdate(user._id, {
      twoFactorSecret: secret,
      twoFactorSetupExpiry: new Date(now + SETUP_WINDOW_MS),
    });
  }

  const appName = 'FCS-26 Network';
  const otpAuthUrl = generateTOTPUri(user.email, secret, appName);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  const expiresAt = isNew
    ? new Date(now + SETUP_WINDOW_MS).toISOString()
    : (user.twoFactorSetupExpiry as Date).toISOString();

  return res.json({
    success: true,
    data: {
      secret,
      qrCode: qrCodeDataUrl,
      expiresAt,
      isNew,
      manualEntry: {
        accountName: user.email,
        issuer: appName,
        secret,
      },
    },
  });
}));

/**
 * POST /api/auth/2fa/enable
 * Confirm the TOTP setup with a valid code, generate backup codes
 */
router.post('/2fa/enable', protect, asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Verification code is required.' });

  const user = await User.findById(req.user!.id).select('+twoFactorSecret');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!user.twoFactorSecret) {
    return res.status(400).json({ success: false, message: 'Please call /2fa/setup first.' });
  }
  if (user.twoFactorEnabled) {
    return res.status(400).json({ success: false, message: '2FA is already enabled.' });
  }

  const isValid = verifyTOTP(String(code), user.twoFactorSecret!);
  let validBackup = false;
  if (!isValid && user.twoFactorBackupCodes) {
    const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    validBackup = user.twoFactorBackupCodes.includes(codeHash);
  }

  if (!isValid && !validBackup) {
    return res.status(400).json({ success: false, message: 'Invalid verification code. Please try again.' });
  }

  // Generate 8 backup codes (hashed for storage)
  const backupCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    backupCodes.push(raw);
    hashedCodes.push(crypto.createHash('sha256').update(raw).digest('hex'));
  }

  user.twoFactorEnabled = true;
  user.twoFactorBackupCodes = hashedCodes;
  // Clear setup expiry — QR can no longer be shown
  await User.findByIdAndUpdate(user._id, {
    twoFactorEnabled: true,
    twoFactorBackupCodes: hashedCodes,
    $unset: { twoFactorSetupExpiry: 1 },
  });

  logSecurityEvent('2FA enabled', { userId: user._id });

  return res.json({
    success: true,
    message: '2FA has been enabled successfully.',
    data: {
      backupCodes, // shown ONCE — user must save them
    },
  });
}));

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA — requires current TOTP code or backup code
 */
router.post('/2fa/disable', protect, asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Verification code is required.' });

  const user = await User.findById(req.user!.id).select('+twoFactorSecret +twoFactorBackupCodes');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!user.twoFactorEnabled) {
    return res.status(400).json({ success: false, message: '2FA is not enabled on this account.' });
  }

  const isValid = verifyTOTP(String(code), user.twoFactorSecret!);
  let validBackup = false;
  if (!isValid && user.twoFactorBackupCodes) {
    const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    validBackup = user.twoFactorBackupCodes.includes(codeHash);
  }

  if (!isValid && !validBackup) {
    return res.status(401).json({ success: false, message: 'Invalid verification code.' });
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorBackupCodes = [];
  await user.save();

  logSecurityEvent('2FA disabled', { userId: user._id }, 'warn');

  return res.json({ success: true, message: '2FA has been disabled.' });
}));

// ===========================================
// Email Verification Routes
// ===========================================

/**
 * GET /api/auth/verify-email
 * Verify email with token from verification link
 */
router.get('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, message: 'Verification token is required.' });

  const hashedToken = crypto.createHash('sha256').update(token as string).digest('hex');
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
  }

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  logSecurityEvent('Email verified', { userId: user._id });

  return res.json({ success: true, message: 'Email verified successfully.' });
}));

/**
 * POST /api/auth/resend-verification
 * Resend email verification link
 */
router.post('/resend-verification', protect, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.isVerified) {
    return res.status(400).json({ success: false, message: 'Email is already verified.' });
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`;
  try {
    await sendVerificationEmail(user.email, verifyUrl);
  } catch {
    return res.status(500).json({ success: false, message: 'Could not send email. Try again later.' });
  }

  return res.json({ success: true, message: 'Verification email resent.' });
}));

export default router;
