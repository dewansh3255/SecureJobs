/**
 * Winston Logger - Centralized Logging
 * Structured logging with different formats for dev/prod
 */

import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

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
    new winston.transports.Console({
      stderrLevels: ['error', 'warn'],
    }),
    ...(config.server.isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880,
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

/**
 * Log a security event to Winston AND persist it to MongoDB (non-blocking).
 * Accepts an optional `req` object so IP / user-agent can be recorded.
 */
export const logSecurityEvent = (
  event: string,
  details: Record<string, unknown>,
  severity: 'info' | 'warn' | 'error' = 'info',
  req?: { ip?: string; headers?: Record<string, string | string[] | undefined>; user?: { id?: string } }
) => {
  logger[severity](`[SECURITY] ${event}`, { ...details, securityEvent: true });

  // Persist to DB asynchronously — never block the request
  setImmediate(async () => {
    try {
      // Lazy-require to avoid circular deps at module load time
      const AuditLog = (await import('../models/AuditLog')).default;
      await AuditLog.create({
        event,
        action: (details.action as string) ?? event,
        severity,
        userId: req?.user?.id ?? (details.userId as string | undefined),
        ip: req?.ip ?? (details.ip as string | undefined),
        userAgent: typeof req?.headers?.['user-agent'] === 'string'
          ? req.headers['user-agent']
          : (details.userAgent as string | undefined),
        details,
      });
    } catch {
      // Silently swallow — logging must never crash the application
    }
  });
};

export default logger;
