/**
 * Winston Logger - Centralized Logging
 * Structured logging with different formats for dev/prod
 */

import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Custom log format for production (JSON)
const prodFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${stack || message}`;
  if (Object.keys(metadata).length) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: config.server.isDevelopment ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    config.server.isDevelopment ? colorize() : winston.format.json(),
    config.server.isDevelopment ? devFormat : prodFormat
  ),
  defaultMeta: { service: 'professional-network-api' },
  transports: [
    // Console output
    new winston.transports.Console({
      stderrLevels: ['error', 'warn'],
    }),
    // File outputs (production only)
    ...(config.server.isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

// Security event logging
export const logSecurityEvent = (
  event: string,
  details: Record<string, unknown>,
  severity: 'info' | 'warn' | 'error' = 'info'
) => {
  logger[severity](`[SECURITY] ${event}`, { ...details, securityEvent: true });
};

export default logger;
