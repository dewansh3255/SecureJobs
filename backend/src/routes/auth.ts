/**
 * Authentication Routes
 * Login, register, logout, refresh token, password management
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { asyncHandler, authRateLimiter, protect, emailValidation, passwordValidation } from '../middleware';
import User from '../models/User';
import config from '../config';
import logger from '../utils/logger';
import { logSecurityEvent } from '../utils/logger';

const router = Router();

/**
 * Generate JWT tokens
 */
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { id: userId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
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
router.post('/register', authRateLimiter, emailValidation, passwordValidation, asyncHandler(async (req, res) => {
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

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id.toString());

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Set cookies
  setTokenCookies(res, accessToken, refreshToken);

  logSecurityEvent('User registered', { userId: user._id, email });

  res.status(201).json({
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
 * Login user
 */
router.post('/login', authRateLimiter, emailValidation, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');

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
    // Increment login attempts
    user.loginAttempts += 1;

    // Lock account after 5 failed attempts
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
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

  // Reset login attempts and update last login
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id.toString());

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Set cookies
  setTokenCookies(res, accessToken, refreshToken);

  logSecurityEvent('User logged in', { userId: user._id, email });

  res.json({
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
router.post('/logout', protect, asyncHandler(async (req, res) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: undefined,
    });

    logSecurityEvent('User logged out', { userId: req.user.id });
  }

  clearTokenCookies(res);

  res.json({
    success: true,
    message: 'Logout successful.',
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
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

    res.json({
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
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?.id).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  res.json({
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
router.post('/forgot-password', authRateLimiter, emailValidation, asyncHandler(async (req, res) => {
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
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // TODO: Store hashed reset token and send email

  logSecurityEvent('Password reset requested', { userId: user._id, email });

  res.json({
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  });
}));

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', authRateLimiter, passwordValidation, asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // TODO: Verify token and update password

  res.json({
    success: true,
    message: 'Password reset successfully.',
  });
}));

export default router;
