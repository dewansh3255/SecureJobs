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
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(process.env.JWT_SECRET || 'secret'));

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
    res.cookie('XSRF-TOKEN', req.csrfToken(), {
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

  // ===========================================
  // Root Route
  // ===========================================
  app.get('/', (req, res) => {
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
