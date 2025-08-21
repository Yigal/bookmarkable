// Main server file following functional programming principles
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialize environment configuration first
const { initializeEnvironment } = require('./config/environment');
const config = initializeEnvironment();

// Initialize logging
const { createLogger, createRequestLogger } = require('./config/logger');
const logger = createLogger(config);

// Initialize caching
const { cacheManager, warmCache } = require('./config/cache');

// Performance monitoring
const {
  responseTimeMiddleware,
  compressionMiddleware,
  performanceOptimizations,
  startHealthMonitoring
} = require('./middleware/performance');

const db = require('./config/database');
const bookmarksRoutes = require('./routes/bookmarks');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Pure functions for server configuration
const createApp = () => {
  const app = express();
  return app;
};

const configureMiddleware = (app) => {
  // Performance optimizations (first)
  app.use(compressionMiddleware);
  app.use(responseTimeMiddleware);
  app.use(performanceOptimizations);
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS configuration
  const corsOptions = {
    origin: (origin, callback) => {
      // Get allowed origins from environment
      const allowedOrigins = config.CORS_ORIGINS.split(',').map(o => o.trim());
      
      // Allow requests with no origin (mobile apps, etc.) in development
      if (!origin && config.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // Allow all origins in development if configured
      if (config.DEV_CORS_ALL_ORIGINS && config.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // Check if origin is allowed
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin.endsWith('://')) {
          // Allow all URLs with this protocol
          return origin && origin.startsWith(allowedOrigin);
        }
        return origin === allowedOrigin;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
  
  app.use(cors(corsOptions));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(createRequestLogger(logger));

  return app;
};

const configureRoutes = (app) => {
  // Serve static files
  app.use(express.static(path.join(__dirname, 'public')));

  // API routes
  app.use('/api/bookmarks', bookmarksRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const { getEnvironmentInfo } = require('./config/environment');
    const envInfo = getEnvironmentInfo();
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: envInfo.environment,
      nodeVersion: envInfo.nodeVersion,
      features: envInfo.featuresEnabled,
      uptime: process.uptime()
    });
  });

  // Detailed health check endpoint
  app.get('/api/health/detailed', async (req, res) => {
    try {
      const { systemHealthCheck } = require('./middleware/performance');
      const { cacheManager } = require('./config/cache');
      const { getEnvironmentInfo } = require('./config/environment');
      
      const health = systemHealthCheck();
      const envInfo = getEnvironmentInfo();
      const cacheStats = cacheManager.getStats();
      
      // Test database connection
      let dbStatus = 'healthy';
      try {
        await db.query('SELECT 1');
      } catch (error) {
        dbStatus = 'unhealthy';
        health.status = 'unhealthy';
      }
      
      res.json({
        ...health,
        environment: envInfo,
        database: {
          status: dbStatus,
          path: config.DB_PATH
        },
        cache: cacheStats,
        dependencies: {
          node: process.version,
          platform: process.platform,
          arch: process.arch
        }
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Performance metrics endpoint
  app.get('/api/metrics', (req, res) => {
    const { getPerformanceMetrics } = require('./middleware/performance');
    const metrics = getPerformanceMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  });

  // Cache status endpoint
  app.get('/api/cache/status', (req, res) => {
    const { cacheManager } = require('./config/cache');
    const stats = cacheManager.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  });

  // Cache management endpoints
  app.post('/api/cache/clear', async (req, res) => {
    try {
      const { cacheManager } = require('./config/cache');
      await cacheManager.clear();
      
      logger.info('Cache cleared via API');
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to clear cache', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        error: error.message
      });
    }
  });

  app.post('/api/cache/warm', async (req, res) => {
    try {
      const { warmCache } = require('./config/cache');
      await warmCache();
      
      logger.info('Cache warmed via API');
      res.json({
        success: true,
        message: 'Cache warmed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to warm cache', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to warm cache',
        error: error.message
      });
    }
  });

  // Serve frontend for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
};

const configureErrorHandling = (app) => {
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

// Server initialization
const initializeServer = async () => {
  try {
    logger.info('Starting Bookmark Sync server...');
    
    // Initialize cache
    await cacheManager.initialize();
    logger.info('Cache system initialized');
    
    // Initialize database
    await db.init();
    logger.info('Database initialized successfully');
    
    // Warm cache with initial data
    await warmCache();
    logger.info('Cache warmed with initial data');

    // Create and configure app
    const app = createApp();
    configureMiddleware(app);
    configureRoutes(app);
    configureErrorHandling(app);

    const PORT = config.PORT;
    
    const server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: config.NODE_ENV,
        database: config.DB_PATH,
        apiUrl: `http://localhost:${PORT}/api/bookmarks`,
        webUrl: `http://localhost:${PORT}`
      });
      
      // Start performance monitoring
      startHealthMonitoring();
      
      console.log(`🚀 Bookmark Sync server running on port ${PORT}`);
      console.log(`📱 Extension API: http://localhost:${PORT}/api/bookmarks`);
      console.log(`🌐 Web Interface: http://localhost:${PORT}`);
      console.log(`💾 Database: ${config.DB_PATH}`);
      console.log(`🔧 Environment: ${config.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        db.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        db.close();
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  initializeServer();
}

module.exports = { initializeServer, createApp, configureMiddleware, configureRoutes };
