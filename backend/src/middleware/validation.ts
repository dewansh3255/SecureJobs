/**
 * Validation Middleware
 * Request validation using express-validator
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AppError } from './errorHandler';

/**
 * Handle Validation Results
 */
export const handleValidationErrors = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err: { msg: string }) => err.msg)
      .join('. ');

    return next(new AppError(`Validation failed: ${errorMessages}`, 400));
  }

  next();
};

/**
 * Email Validation Rules
 */
export const emailValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
  handleValidationErrors,
];

/**
 * Password Validation Rules
 */
export const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .isLength({ max: 128 })
    .withMessage('Password must be less than 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  handleValidationErrors,
];

/**
 * Name Validation Rules
 */
export const nameValidation = (fieldName = 'name') => [
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`)
    .isLength({ min: 2, max: 50 })
    .withMessage(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be between 2 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} can only contain letters, spaces, hyphens, and apostrophes`),
  handleValidationErrors,
];

/**
 * ID Validation Rules (for URL parameters)
 */
export const idValidation = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid ID format'),
  handleValidationErrors,
];

/**
 * Pagination Validation
 */
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  handleValidationErrors,
];

/**
 * Search/Filter Validation
 */
export const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be less than 100 characters')
    .escape(),
  handleValidationErrors,
];

/**
 * Profile Update Validation
 */
export const profileUpdateValidation = [
  body('headline')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Headline must be less than 100 characters')
    .escape(),
  body('about')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('About section must be less than 2000 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  body('industry')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Industry must be less than 50 characters'),
  body('website')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Website must be a valid http:// or https:// URL'),
  handleValidationErrors,
];

/**
 * Post Creation Validation
 */
export const postValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Post content is required')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Post content must be between 1 and 5000 characters'),
  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  handleValidationErrors,
];

/**
 * Comment Validation
 */
export const commentValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  handleValidationErrors,
];

/**
 * Connection Request Validation
 */
export const connectionRequestValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid user ID format'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Connection message must be less than 300 characters'),
  handleValidationErrors,
];

/**
 * Job Posting Validation
 */
export const jobValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Job title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Job title must be between 3 and 100 characters'),
  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Job description is required')
    .isLength({ min: 50, max: 10000 })
    .withMessage('Job description must be between 50 and 10000 characters'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Job location is required')
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  body('type')
    .trim()
    .isIn(['full-time', 'part-time', 'contract', 'internship', 'remote'])
    .withMessage('Invalid job type'),
  handleValidationErrors,
];
