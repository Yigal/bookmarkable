// Error handling middleware following functional programming principles
const { logError: logStructuredError } = require('../config/logger');
const { createLogger } = require('../config/logger');

// Initialize logger for error handling
const logger = createLogger();

// Pure functions for error formatting
const formatError = (error, isDevelopment = false) => {
  const baseError = {
    success: false,
    message: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  };

  if (isDevelopment) {
    return {
      ...baseError,
      stack: error.stack,
      details: error
    };
  }

  return baseError;
};

const getErrorStatus = (error) => {
  // Default status codes for common error types
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'CastError') return 400;
  if (error.name === 'UnauthorizedError') return 401;
  if (error.name === 'ForbiddenError') return 403;
  if (error.name === 'NotFoundError') return 404;
  if (error.name === 'ConflictError') return 409;
  
  return error.status || error.statusCode || 500;
};

const logError = (error, req) => {
  const context = {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  };
  
  // Use structured logging
  logStructuredError(logger, error, context);
  
  // Keep console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', {
      error: error.message,
      stack: error.stack,
      ...context
    });
  }
  
  return context;
};

// Middleware functions
const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

const errorHandler = (error, req, res, next) => {
  // Log the error
  logError(error, req);
  
  // Determine status code
  const status = getErrorStatus(error);
  
  // Format error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = formatError(error, isDevelopment);
  
  // Send error response
  res.status(status).json(errorResponse);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.status = 400;
    error.details = errors.array();
    return next(error);
  }
  
  next();
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  handleValidationErrors,
  formatError,
  getErrorStatus,
  logError
};
