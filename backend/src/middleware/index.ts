/**
 * Middleware Exports
 * Central export for all middleware
 */

export {
  helmetMiddleware,
  apiRateLimiter,
  authRateLimiter,
  registerRateLimiter,
  speedLimiter,
  uploadRateLimiter,
  postRateLimiter,
  connectionRateLimiter,
  searchRateLimiter,
  jobApplyRateLimiter,
  passwordResetRateLimiter,
  messagingRateLimiter,
  mongoSanitize,
  hppMiddleware,
  xssMiddleware,
  corsOptions,
  securityHeaders,
  requestLogger,
} from './security';

export {
  protect,
  restrictTo,
  optionalAuth,
} from './auth';

export {
  AppError,
  errorHandler,
  asyncHandler,
} from './errorHandler';

export {
  handleValidationErrors,
  emailValidation,
  passwordValidation,
  nameValidation,
  idValidation,
  paginationValidation,
  searchValidation,
  profileUpdateValidation,
  postValidation,
  commentValidation,
  connectionRequestValidation,
  jobValidation,
} from './validation';
