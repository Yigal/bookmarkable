// Structured logging configuration using Winston
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format for better readability
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger configuration based on environment
const createLogger = (config = {}) => {
  const logLevel = config.LOG_LEVEL || process.env.LOG_LEVEL || 'info';
  const nodeEnv = config.NODE_ENV || process.env.NODE_ENV || 'development';
  
  const transports = [];
  
  // Console transport (always present)
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: nodeEnv === 'production' ? logFormat : consoleFormat
    })
  );
  
  // File transports for non-test environments
  if (nodeEnv !== 'test') {
    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        level: 'info',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    );
    
    // Error log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    );
    
    // Access log file for production
    if (nodeEnv === 'production') {
      transports.push(
        new winston.transports.File({
          filename: path.join(logsDir, 'access.log'),
          level: 'info',
          format: logFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true
        })
      );
    }
  }
  
  const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { 
      service: 'bookmark-sync',
      version: process.env.npm_package_version || '1.0.0',
      environment: nodeEnv
    },
    transports,
    exitOnError: false
  });
  
  // Handle uncaught exceptions and unhandled rejections
  if (nodeEnv === 'production') {
    logger.exceptions.handle(
      new winston.transports.File({ 
        filename: path.join(logsDir, 'exceptions.log'),
        format: logFormat
      })
    );
    
    logger.rejections.handle(
      new winston.transports.File({ 
        filename: path.join(logsDir, 'rejections.log'),
        format: logFormat
      })
    );
  }
  
  return logger;
};

// Request correlation ID generator
const generateCorrelationId = () => {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Request logging middleware
const createRequestLogger = (logger) => {
  return (req, res, next) => {
    // Generate correlation ID for request tracking
    const correlationId = generateCorrelationId();
    req.correlationId = correlationId;
    
    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);
    
    // Log request start
    const startTime = Date.now();
    logger.info('Request started', {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });\n    \n    // Override res.json to log response\n    const originalJson = res.json;\n    res.json = function(body) {\n      const duration = Date.now() - startTime;\n      \n      // Log response\n      logger.info('Request completed', {\n        correlationId,\n        method: req.method,\n        url: req.url,\n        statusCode: res.statusCode,\n        duration: `${duration}ms`,\n        responseSize: JSON.stringify(body).length\n      });\n      \n      return originalJson.call(this, body);\n    };\n    \n    // Log response end\n    res.on('finish', () => {\n      const duration = Date.now() - startTime;\n      \n      if (!res.headersSent || res.statusCode >= 400) {\n        const logLevel = res.statusCode >= 500 ? 'error' : \n                        res.statusCode >= 400 ? 'warn' : 'info';\n        \n        logger.log(logLevel, 'Request finished', {\n          correlationId,\n          method: req.method,\n          url: req.url,\n          statusCode: res.statusCode,\n          duration: `${duration}ms`\n        });\n      }\n    });\n    \n    next();\n  };\n};\n\n// Error logging utility\nconst logError = (logger, error, context = {}) => {\n  logger.error('Application error', {\n    error: {\n      name: error.name,\n      message: error.message,\n      stack: error.stack,\n      code: error.code\n    },\n    ...context\n  });\n};\n\n// Performance logging utility\nconst logPerformance = (logger, operation, duration, metadata = {}) => {\n  const logLevel = duration > 1000 ? 'warn' : 'info';\n  \n  logger.log(logLevel, 'Performance metric', {\n    operation,\n    duration: `${duration}ms`,\n    ...metadata\n  });\n};\n\n// Database operation logging\nconst logDatabaseOperation = (logger, operation, query, params = [], duration = 0, correlationId = null) => {\n  logger.debug('Database operation', {\n    correlationId,\n    operation,\n    query: query.replace(/\\s+/g, ' ').trim(),\n    paramCount: params.length,\n    duration: duration ? `${duration}ms` : undefined\n  });\n};\n\n// Security event logging\nconst logSecurityEvent = (logger, event, details = {}, severity = 'warn') => {\n  logger.log(severity, 'Security event', {\n    event,\n    timestamp: new Date().toISOString(),\n    ...details\n  });\n};\n\n// Business event logging\nconst logBusinessEvent = (logger, event, details = {}) => {\n  logger.info('Business event', {\n    event,\n    timestamp: new Date().toISOString(),\n    ...details\n  });\n};\n\n// System health logging\nconst logSystemHealth = (logger, metrics) => {\n  logger.info('System health', {\n    timestamp: new Date().toISOString(),\n    uptime: process.uptime(),\n    memory: process.memoryUsage(),\n    ...metrics\n  });\n};\n\nmodule.exports = {\n  createLogger,\n  createRequestLogger,\n  logError,\n  logPerformance,\n  logDatabaseOperation,\n  logSecurityEvent,\n  logBusinessEvent,\n  logSystemHealth,\n  generateCorrelationId\n};