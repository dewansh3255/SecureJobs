/**
 * Security Middleware
 * Comprehensive security layers for the application
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitizeLib from 'express-mongo-sanitize';
import hpp from 'hpp';
import xss from 'xss-clean';
import config from '../config';
import { logSecurityEvent } from '../utils/logger';

/**
 * Helmet Configuration
 * Sets various HTTP security headers
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

/**
 * Rate Limiter - General API
 * Prevents brute force and DoS attacks
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip session-maintenance and CSRF-preflight endpoints so they never eat quota
  skip: (req) => {
    const safe = ['/api/csrf-token', '/api/auth/me', '/api/auth/refresh', '/api/health'];
    return safe.some((path) => req.path === path || req.originalUrl === path);
  },
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
  handler: (req, res) => {
    logSecurityEvent('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent'),
    }, 'warn');
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Rate Limiter - Authentication Endpoints
 * Stricter limits for login/register endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.authMaxRequests,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Never consume auth-quota for session maintenance
  skip: (req) => {
    const noLimit = ['/api/auth/me', '/api/auth/refresh', '/api/csrf-token'];
    return noLimit.some((p) => req.originalUrl === p);
  },
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
  handler: (req, res) => {
    logSecurityEvent('Auth rate limit exceeded - possible brute force', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    }, 'warn');
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again after 15 minutes.',
    });
  },
});

/**
 * Speed Limiter - Slows down suspicious requests
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (hits) => Math.min(hits * 100, 5000),
});

/**
 * Request Sanitization
 * Prevents NoSQL injection by sanitizing MongoDB operators
 */
export const mongoSanitize = mongoSanitizeLib();

/**
 * Parameter Pollution Protection
 * Prevents HTTP Parameter Pollution attacks
 */
export const hppMiddleware = hpp();

/**
 * XSS Protection
 * Sanitizes user input to prevent XSS attacks
 */
export const xssMiddleware = xss();

/**
 * CORS Configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = config.cors.origin;

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logSecurityEvent('CORS blocked request', {
        origin,
        path: (callback as unknown as { req?: { path?: string } })?.req?.path,
      }, 'warn');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
  optionsSuccessStatus: 200,
};

/**
 * Security Headers for API Responses
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Prevent caching of sensitive data
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });

  next();
};

/**
 * Request Logging Middleware
 * Logs all incoming requests for audit purposes
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      logSecurityEvent('Request completed with error', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      }, 'warn');
    }
  });

  next();
};

/**
 * Rate Limiter - File Upload
 * Max 20 uploads per hour per IP
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many uploads. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter - Post Creation
 * Max 30 posts per hour per IP
 */
export const postRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many posts. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter - Connection Requests
 * Max 50 connection requests per hour per IP
 */
export const connectionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many connection requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter - Search
 * Max 60 searches per minute per IP
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Search rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter - Job Apply
 * Max 10 applications per hour per IP
 */
export const jobApplyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many job applications. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter - Password Reset
 * Max 3 password reset emails per hour per IP
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many password reset requests. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter - Messaging
 * Max 200 messages per hour per IP (prevents spam)
 */
export const messagingRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Messaging rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});
