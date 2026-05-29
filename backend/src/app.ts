/**
 * Express App Configuration
 * Main application setup with all middleware and routes
 */

import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import session from 'express-session';
import { corsOptions } from './middleware/security';
import {
  helmetMiddleware,
  apiRateLimiter,
  speedLimiter,
  mongoSanitize,
  hppMiddleware,
  xssMiddleware,
  requestLogger,
} from './middleware';
import { errorHandler } from './middleware';
import logger from './utils/logger';
import { csrfToken, csrfProtect } from './middleware/csrf';
import config from './config';
import passport from './config/passport';

// Route imports
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import connectionRoutes from './routes/connection';
import postRoutes from './routes/post';
import messageRoutes from './routes/message';
import jobRoutes from './routes/job';
import notificationRoutes from './routes/notification';
import adminRoutes from './routes/admin';
import recommendationsRoutes from './routes/recommendations';
import companyRoutes from './routes/company';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // ===========================================
  // Trust proxy (only in production behind nginx)
  // In development, this would let clients spoof X-Forwarded-For to bypass rate limits
  // ===========================================
  if (config.server.isProduction) app.set('trust proxy', 1);

  // ===========================================
  // Security Middleware
  // ===========================================
  app.use(helmetMiddleware);
  app.use(cors(corsOptions));

  // ===========================================
  // Rate Limiting
  // ===========================================
  app.use('/api/auth/', speedLimiter);
  app.use('/api/', apiRateLimiter);

  // ===========================================
  // Body Parsing Middleware
  // ===========================================
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(config.cookie.secret));

  // ===========================================
  // Session (used only for OAuth state handshake)
  // ===========================================
  app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.server.isProduction,
      sameSite: 'lax',   // lax allows the OAuth redirect callback
      maxAge: 10 * 60 * 1000, // 10 minutes — just enough for OAuth flow
    },
  }));

  // ===========================================
  // Passport (OAuth only)
  // ===========================================
  app.use(passport.initialize());
  app.use(passport.session());

  // ===========================================
  // Compression
  // ===========================================
  app.use(compression());

  // ===========================================
  // Data Sanitization
  // ===========================================
  app.use(mongoSanitize);
  app.use(xssMiddleware);
  app.use(hppMiddleware);

  // ===========================================
  // Request Logging
  // ===========================================
  app.use(requestLogger);

  // ===========================================
  // CSRF Protection (custom double-submit signed cookie)
  // ===========================================
  app.use(csrfToken);      // issue XSRF-TOKEN cookie on every response
  app.use(csrfProtect);    // enforce on POST/PUT/PATCH/DELETE

  // ===========================================
  // API Routes
  // ===========================================
  // CSRF token endpoint (GET — safe, no CSRF check needed)
  app.get('/api/csrf-token', (_req, res) => res.json({ success: true }));
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/recommendations', recommendationsRoutes);
  app.use('/api/companies', companyRoutes);

  // Serve uploaded files — public assets (profile pics, covers) served directly;
  // all other paths (resumes etc.) are proxied through the backend with auth
  app.use('/uploads/profiles', express.static('uploads/profiles'));
  app.use('/uploads/covers', express.static('uploads/covers'));
  // Resume downloads go through an authenticated API route (/api/users/me/resume/download)
  // so raw /uploads/resumes/* is blocked here

  // ===========================================
  // Root Route
  // ===========================================
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'Professional Network API - FCS-26',
      version: '1.0.0',
      documentation: '/api/docs',
    });
  });

  // ===========================================
  // 404 Handler
  // ===========================================
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
    });
  });

  // ===========================================
  // Global Error Handler
  // ===========================================
  app.use(errorHandler);

  logger.info('✅ Express app configured successfully');

  return app;
};

export default createApp;
