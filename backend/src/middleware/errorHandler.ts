/**
 * Error Handler Middleware
 * Centralized error handling with proper status codes and messages
 */

import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../utils/logger';

interface IAppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  keyPattern?: Record<string, number>;
  value?: unknown;
  path?: string;
  errors?: Array<{ message: string; path?: string }>;
}

/**
 * Base App Error Class
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle MongoDB Duplicate Key Error
 */
const handleDuplicateKeyError = (err: IAppError) => {
  const field = Object.keys(err.keyPattern || {})[0];
  const message = `Duplicate value for field: ${field}`;

  return new AppError(message, 400);
};

/**
 * Handle MongoDB Validation Error
 */
const handleValidationError = (err: IAppError) => {
  const errors = Object.values(err.errors || {}).map((e: unknown) => {
    const error = e as { message?: string };
    return error.message || 'Validation error';
  });

  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401);
};

/**
 * Development Error Response
 * Detailed error information for debugging
 */
const sendDevError = (res: Response, err: IAppError) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

/**
 * Production Error Response
 * Generic error messages to prevent information leakage
 */
const sendProdError = (res: Response, err: IAppError) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.isOperational ? err.message : 'Something went wrong. Please try again.',
  });
};

/**
 * Global Error Handler
 */
export const errorHandler = (
  err: IAppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: config.server.isDevelopment ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Mongoose duplicate key
  if (Number(err.code) === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${(err as IAppError).value}`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Send response
  if (config.server.isDevelopment) {
    sendDevError(res, error);
  } else {
    sendProdError(res, error);
  }
};

/**
 * Async Handler Wrapper
 * Eliminates need for try-catch in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
