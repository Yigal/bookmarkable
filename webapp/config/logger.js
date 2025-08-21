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
    });
    
    // Log response end
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      const logLevel = res.statusCode >= 500 ? 'error' : 
                      res.statusCode >= 400 ? 'warn' : 'info';
      
      logger.log(logLevel, 'Request finished', {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });
    
    next();
  };
};

// Error logging utility
const logError = (logger, error, context = {}) => {
  logger.error('Application error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    ...context
  });
};

// Performance logging utility
const logPerformance = (logger, operation, duration, metadata = {}) => {
  const logLevel = duration > 1000 ? 'warn' : 'info';
  
  logger.log(logLevel, 'Performance metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};

// Database operation logging
const logDatabaseOperation = (logger, operation, query, params = [], duration = 0, correlationId = null) => {
  logger.debug('Database operation', {
    correlationId,
    operation,
    query: query.replace(/\s+/g, ' ').trim(),
    paramCount: params.length,
    duration: duration ? `${duration}ms` : undefined
  });
};

// Security event logging
const logSecurityEvent = (logger, event, details = {}, severity = 'warn') => {
  logger.log(severity, 'Security event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Business event logging
const logBusinessEvent = (logger, event, details = {}) => {
  logger.info('Business event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// System health logging
const logSystemHealth = (logger, metrics) => {
  logger.info('System health', {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    ...metrics
  });
};

module.exports = {
  createLogger,
  createRequestLogger,
  logError,
  logPerformance,
  logDatabaseOperation,
  logSecurityEvent,
  logBusinessEvent,
  logSystemHealth,
  generateCorrelationId
};