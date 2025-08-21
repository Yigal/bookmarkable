// Performance monitoring middleware
const responseTime = require('response-time');
const compression = require('compression');
const { createLogger, logPerformance, logSystemHealth } = require('../config/logger');

const logger = createLogger();

// Performance metrics storage
const performanceMetrics = {
  requests: {
    total: 0,
    byEndpoint: new Map(),
    byMethod: new Map(),
    byStatusCode: new Map()
  },
  responseTimes: {
    total: 0,
    count: 0,
    min: Infinity,
    max: 0,
    avg: 0,
    p95: 0,
    p99: 0,
    history: []
  },
  system: {
    startTime: Date.now(),
    lastHealthCheck: Date.now(),
    errors: 0
  }
};

// Response time tracking
const responseTimeMiddleware = responseTime((req, res, time) => {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  const statusCode = res.statusCode;

  // Update metrics
  performanceMetrics.requests.total++;
  
  // By endpoint
  const endpointCount = performanceMetrics.requests.byEndpoint.get(endpoint) || 0;
  performanceMetrics.requests.byEndpoint.set(endpoint, endpointCount + 1);
  
  // By method
  const methodCount = performanceMetrics.requests.byMethod.get(req.method) || 0;
  performanceMetrics.requests.byMethod.set(req.method, methodCount + 1);
  
  // By status code
  const statusCount = performanceMetrics.requests.byStatusCode.get(statusCode) || 0;
  performanceMetrics.requests.byStatusCode.set(statusCode, statusCount + 1);

  // Response time metrics
  performanceMetrics.responseTimes.total += time;
  performanceMetrics.responseTimes.count++;
  performanceMetrics.responseTimes.min = Math.min(performanceMetrics.responseTimes.min, time);
  performanceMetrics.responseTimes.max = Math.max(performanceMetrics.responseTimes.max, time);
  performanceMetrics.responseTimes.avg = performanceMetrics.responseTimes.total / performanceMetrics.responseTimes.count;

  // Keep history for percentile calculations (last 1000 requests)
  performanceMetrics.responseTimes.history.push(time);
  if (performanceMetrics.responseTimes.history.length > 1000) {
    performanceMetrics.responseTimes.history.shift();
  }

  // Calculate percentiles
  if (performanceMetrics.responseTimes.history.length > 10) {
    const sorted = [...performanceMetrics.responseTimes.history].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    performanceMetrics.responseTimes.p95 = sorted[p95Index];
    performanceMetrics.responseTimes.p99 = sorted[p99Index];
  }

  // Log slow requests
  if (time > 1000) {
    logPerformance(logger, 'slow_request', time, {
      endpoint,
      method: req.method,
      statusCode,
      url: req.originalUrl,
      correlationId: req.correlationId
    });
  }

  // Track errors
  if (statusCode >= 500) {
    performanceMetrics.system.errors++;
  }

  // Add performance headers
  res.setHeader('X-Response-Time', `${time.toFixed(2)}ms`);
});

// Compression middleware with options
const compressionMiddleware = compression({
  // Only compress responses larger than 1kb
  threshold: 1024,
  
  // Compression level (1-9, 6 is default)
  level: 6,
  
  // Only compress these MIME types
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

// Memory usage monitoring
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
  };
};

// CPU usage monitoring (approximation)
let lastCpuUsage = process.cpuUsage();
const getCpuUsage = () => {
  const currentUsage = process.cpuUsage(lastCpuUsage);
  lastCpuUsage = process.cpuUsage();
  
  const totalUsage = currentUsage.user + currentUsage.system;
  const totalTime = totalUsage / 1000; // Convert to milliseconds
  const period = 1000; // 1 second period
  
  return {
    user: Math.round((currentUsage.user / 1000 / period) * 100),
    system: Math.round((currentUsage.system / 1000 / period) * 100),
    total: Math.round((totalTime / period) * 100)
  };
};

// System health monitoring
const systemHealthCheck = () => {
  const memory = getMemoryUsage();
  const cpu = getCpuUsage();
  const uptime = Math.round(process.uptime());
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    memory,
    cpu,
    performance: {
      totalRequests: performanceMetrics.requests.total,
      averageResponseTime: Math.round(performanceMetrics.responseTimes.avg),
      p95ResponseTime: Math.round(performanceMetrics.responseTimes.p95),
      p99ResponseTime: Math.round(performanceMetrics.responseTimes.p99),
      errorRate: performanceMetrics.requests.total > 0 
        ? ((performanceMetrics.system.errors / performanceMetrics.requests.total) * 100).toFixed(2)
        : 0
    }
  };

  // Determine health status
  if (memory.heapUsed > 512 || cpu.total > 80) {
    health.status = 'degraded';
  }
  
  if (memory.heapUsed > 1024 || cpu.total > 95 || performanceMetrics.responseTimes.avg > 5000) {
    health.status = 'unhealthy';
  }

  return health;
};

// Performance optimization middleware
const performanceOptimizations = (req, res, next) => {
  // Set cache headers for static content
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    res.setHeader('ETag', `"${Date.now()}"`);
  }

  // Set no-cache for API endpoints
  if (req.url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Add security headers for performance
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  res.setHeader('X-Powered-By', 'Bookmark-Sync');

  next();
};

// Database query optimization middleware
const queryOptimizationMiddleware = (req, res, next) => {
  // Track database query times
  const originalQuery = req.db?.query;
  if (originalQuery) {
    req.db.query = async function(...args) {
      const start = Date.now();
      try {
        const result = await originalQuery.apply(this, args);
        const duration = Date.now() - start;
        
        if (duration > 100) { // Log slow queries
          logger.warn('Slow database query', {
            query: args[0]?.substring(0, 100),
            duration: `${duration}ms`,
            correlationId: req.correlationId
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error('Database query error', {
          query: args[0]?.substring(0, 100),
          duration: `${duration}ms`,
          error: error.message,
          correlationId: req.correlationId
        });
        throw error;
      }
    };
  }
  
  next();
};

// Performance metrics endpoint
const getPerformanceMetrics = () => {
  const health = systemHealthCheck();
  
  return {
    ...health,
    requests: {
      total: performanceMetrics.requests.total,
      byEndpoint: Object.fromEntries(performanceMetrics.requests.byEndpoint),
      byMethod: Object.fromEntries(performanceMetrics.requests.byMethod),
      byStatusCode: Object.fromEntries(performanceMetrics.requests.byStatusCode)
    },
    responseTimes: {
      average: Math.round(performanceMetrics.responseTimes.avg),
      min: Math.round(performanceMetrics.responseTimes.min),
      max: Math.round(performanceMetrics.responseTimes.max),
      p95: Math.round(performanceMetrics.responseTimes.p95),
      p99: Math.round(performanceMetrics.responseTimes.p99)
    }
  };
};

// Periodic health logging
const startHealthMonitoring = (interval = 300000) => { // 5 minutes
  setInterval(() => {
    const health = systemHealthCheck();
    logSystemHealth(logger, health);
    performanceMetrics.system.lastHealthCheck = Date.now();
  }, interval);
  
  logger.info('Health monitoring started', { interval: `${interval/1000}s` });
};

// Graceful performance monitoring cleanup
const cleanup = () => {
  // Log final performance metrics
  const finalMetrics = getPerformanceMetrics();
  logger.info('Final performance metrics', finalMetrics);
};

module.exports = {
  responseTimeMiddleware,
  compressionMiddleware,
  performanceOptimizations,
  queryOptimizationMiddleware,
  getPerformanceMetrics,
  systemHealthCheck,
  startHealthMonitoring,
  cleanup,
  performanceMetrics
};