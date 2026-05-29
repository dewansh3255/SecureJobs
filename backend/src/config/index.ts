/**
 * Application Configuration
 * Centralized configuration management with validation
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Configuration schema with validation
const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),

  // Database
  MONGODB_URI: z.string().min(1),

  // Redis
  REDIS_URL: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('20m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CSRF (separate secret from JWT — required, must never fall back to JWT_SECRET)
  CSRF_SECRET: z.string().min(32),

  // Resume encryption key (64 hex chars = 32 bytes AES-256)
  RESUME_ENCRYPTION_KEY: z.string().length(64).optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().default(5),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost/api/auth/google/callback'),

  // Session (OAuth handshake only) — required, no default
  SESSION_SECRET: z.string().min(32),

  // Cookie parser signing secret — separate from JWT
  COOKIE_SECRET: z.string().min(32),
});

// Validate and parse environment variables
const validateConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.')).join(', ');
      console.error(`❌ Invalid environment configuration:`);
      console.error(`   Missing or invalid: ${missingVars}`);
      console.error(`\n📋 Check your .env file against .env.example`);
      process.exit(1);
    }
    throw error;
  }
};

export const config = validateConfig();

// Export typed configuration
export default {
  server: {
    env: config.NODE_ENV,
    port: config.PORT,
    isProduction: config.NODE_ENV === 'production',
    isDevelopment: config.NODE_ENV === 'development',
  },
  database: {
    uri: config.MONGODB_URI,
    options: {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  redis: {
    url: config.REDIS_URL,
  },
  jwt: {
    secret: config.JWT_SECRET,
    refreshSecret: config.JWT_REFRESH_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
    refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
  },
  csrf: {
    secret: config.CSRF_SECRET,
  },
  cors: {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    clientUrl: config.CLIENT_URL,
  },
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    authMaxRequests: config.RATE_LIMIT_AUTH_MAX_REQUESTS,
  },
  upload: {
    maxFileSize: config.MAX_FILE_SIZE,
    allowedFileTypes: config.ALLOWED_FILE_TYPES.split(','),
  },
  email: {
    smtp: {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    from: config.EMAIL_FROM,
  },
  google: {
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackUrl: config.GOOGLE_CALLBACK_URL,
    enabled: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
  },
  session: {
    secret: config.SESSION_SECRET,
  },
  cookie: {
    secret: config.COOKIE_SECRET,
  },
};
