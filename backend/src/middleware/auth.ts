/**
 * Authentication Middleware
 * JWT token verification and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import config from '../config';
import User from '../models/User';
import { logSecurityEvent } from '../utils/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: Types.ObjectId;
        email: string;
        role: string;
      };
    }
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Protect Routes - Verify JWT Access Token
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      logSecurityEvent('Unauthorized access attempt - no token', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'You are not logged in. Please log in to access this resource.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Check if user still exists
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      logSecurityEvent('Token for non-existent user', {
        userId: decoded.id,
        ip: req.ip,
      }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Check if user is deactivated
    if (!user.isActive) {
      logSecurityEvent('Deactivated user access attempt', {
        userId: decoded.id,
        email: decoded.email,
        ip: req.ip,
      }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Attach user to request
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logSecurityEvent('Expired token access attempt', {
        path: req.path,
        ip: req.ip,
      }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'Your token has expired. Please log in again.',
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logSecurityEvent('Invalid token access attempt', {
        path: req.path,
        ip: req.ip,
      }, 'warn');
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    logSecurityEvent('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    }, 'error');

    return res.status(500).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

/**
 * Restrict Access to Specific Roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to access this resource.',
      });
    }

    if (!roles.includes(req.user.role)) {
      logSecurityEvent('Unauthorized role access attempt', {
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: roles,
        path: req.path,
      }, 'warn');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }

    return next();
  };
};

/**
 * Optional Authentication
 * Attaches user if token is present, but doesn't require it
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const user = await User.findById(decoded.id).select('-password');

      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          role: user.role,
        };
      }
    }
  } catch (error) {
    // Silently fail - authentication is optional
  }

  next();
};
