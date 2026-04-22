/**
 * Express App Configuration
 * Main application setup with all middleware and routes
 */

import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import csurf from 'csurf';
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
import config from './config';

// Route imports
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import connectionRoutes from './routes/connection';
import postRoutes from './routes/post';
import messageRoutes from './routes/message';
import jobRoutes from './routes/job';
import notificationRoutes from './routes/notification';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // ===========================================
  // Trust proxy (for rate limiting behind proxies)
  // ===========================================
  app.set('trust proxy', 1);

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
  app.use(cookieParser(config.jwt.secret));

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
  // CSRF Protection (for state-changing requests)
  // ===========================================
  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        secure: config.server.isProduction,
        sameSite: 'strict',
      },
    })
  );

  // Add CSRF token to response
  app.use((req, res, next) => {
    res.cookie('XSRF-TOKEN', (req as any).csrfToken(), {
      httpOnly: false,
      secure: config.server.isProduction,
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });
    next();
  });

  // ===========================================
  // API Routes
  // ===========================================
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

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
