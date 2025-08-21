// Comprehensive caching system with Redis and memory fallback
const redis = require('redis');
const MemoryCache = require('memory-cache');
const { createLogger, logPerformance } = require('./logger');

const logger = createLogger();

// Cache configuration
const CACHE_CONFIG = {
  defaultTTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
  maxMemoryEntries: 1000,
  checkPeriod: 600000, // 10 minutes
  redisUrl: process.env.REDIS_URL,
  keyPrefix: 'bookmark-sync:'
};

class CacheManager {
  constructor() {
    this.redisClient = null;
    this.memoryCache = MemoryCache;
    this.useRedis = false;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  async initialize() {
    if (CACHE_CONFIG.redisUrl) {
      try {
        this.redisClient = redis.createClient({
          url: CACHE_CONFIG.redisUrl,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              logger.warn('Redis connection refused, falling back to memory cache');
              return undefined;
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              logger.error('Redis retry time exhausted');
              return undefined;
            }
            if (options.attempt > 10) {
              logger.error('Redis max attempts reached');
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        await this.redisClient.connect();
        this.useRedis = true;
        logger.info('Redis cache initialized successfully');
      } catch (error) {
        logger.warn('Redis unavailable, using memory cache only', { error: error.message });
        this.useRedis = false;
      }
    } else {
      logger.info('Redis not configured, using memory cache only');
    }

    // Configure memory cache cleanup
    this.memoryCache.debug(process.env.NODE_ENV === 'development');
    
    // Periodic cleanup for memory cache
    setInterval(() => {
      const size = this.memoryCache.size();
      if (size > CACHE_CONFIG.maxMemoryEntries) {
        this.memoryCache.clear();
        logger.info('Memory cache cleared due to size limit', { size });
      }
    }, CACHE_CONFIG.checkPeriod);

    return this;
  }

  _generateKey(key) {
    return `${CACHE_CONFIG.keyPrefix}${key}`;
  }

  async get(key) {
    const fullKey = this._generateKey(key);
    const startTime = Date.now();

    try {
      let value = null;

      if (this.useRedis && this.redisClient?.isReady) {
        try {
          const redisValue = await this.redisClient.get(fullKey);
          if (redisValue !== null) {
            value = JSON.parse(redisValue);
          }
        } catch (error) {
          logger.warn('Redis get error, falling back to memory', { key, error: error.message });
          this.stats.errors++;
        }
      }

      // Fallback to memory cache
      if (value === null) {
        value = this.memoryCache.get(fullKey);
      }

      const duration = Date.now() - startTime;

      if (value !== null) {
        this.stats.hits++;
        logPerformance(logger, 'cache_hit', duration, { key, useRedis: this.useRedis });
        return value;
      } else {
        this.stats.misses++;
        logPerformance(logger, 'cache_miss', duration, { key });
        return null;
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = CACHE_CONFIG.defaultTTL) {
    const fullKey = this._generateKey(key);
    const startTime = Date.now();

    try {
      const serializedValue = JSON.stringify(value);

      // Set in Redis
      if (this.useRedis && this.redisClient?.isReady) {
        try {
          await this.redisClient.setEx(fullKey, ttl, serializedValue);
        } catch (error) {
          logger.warn('Redis set error', { key, error: error.message });
          this.stats.errors++;
        }
      }

      // Set in memory cache (always)
      this.memoryCache.put(fullKey, value, ttl * 1000);

      this.stats.sets++;
      const duration = Date.now() - startTime;
      logPerformance(logger, 'cache_set', duration, { key, ttl, useRedis: this.useRedis });

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  async delete(key) {
    const fullKey = this._generateKey(key);
    const startTime = Date.now();

    try {
      // Delete from Redis
      if (this.useRedis && this.redisClient?.isReady) {
        try {
          await this.redisClient.del(fullKey);
        } catch (error) {
          logger.warn('Redis delete error', { key, error: error.message });
          this.stats.errors++;
        }
      }

      // Delete from memory cache
      this.memoryCache.del(fullKey);

      this.stats.deletes++;
      const duration = Date.now() - startTime;
      logPerformance(logger, 'cache_delete', duration, { key });

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  async clear() {
    try {
      // Clear Redis
      if (this.useRedis && this.redisClient?.isReady) {
        try {
          const keys = await this.redisClient.keys(`${CACHE_CONFIG.keyPrefix}*`);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        } catch (error) {
          logger.warn('Redis clear error', { error: error.message });
        }
      }

      // Clear memory cache
      this.memoryCache.clear();

      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Cache clear error', { error: error.message });
      return false;
    }
  }

  async close() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', { error: error.message });
      }
    }
  }

  getStats() {
    const memorySize = this.memoryCache.size();
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memorySize,
      useRedis: this.useRedis,
      redisConnected: this.redisClient?.isReady || false
    };
  }
}

// Global cache instance
const cacheManager = new CacheManager();

// Cache middleware for Express routes
const cacheMiddleware = (ttl = CACHE_CONFIG.defaultTTL, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `route:${req.originalUrl}:${JSON.stringify(req.query)}`;

    try {
      // Try to get from cache
      const cachedData = await cacheManager.get(cacheKey);
      
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cachedData);
      }

      // Cache miss - continue to route handler
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data && data.success !== false) {
          cacheManager.set(cacheKey, data, ttl).catch(error => {
            logger.warn('Failed to cache response', { cacheKey, error: error.message });
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { cacheKey, error: error.message });
      next();
    }
  };
};

// Specific cache functions for common operations
const bookmarkCache = {
  getRecentBookmarks: async (limit = 10) => {
    const key = `recent_bookmarks:${limit}`;
    return await cacheManager.get(key);
  },

  setRecentBookmarks: async (bookmarks, limit = 10) => {
    const key = `recent_bookmarks:${limit}`;
    return await cacheManager.set(key, bookmarks, 300); // 5 minutes
  },

  getTags: async () => {
    return await cacheManager.get('all_tags');
  },

  setTags: async (tags) => {
    return await cacheManager.set('all_tags', tags, 1800); // 30 minutes
  },

  getBookmarkById: async (id) => {
    const key = `bookmark:${id}`;
    return await cacheManager.get(key);
  },

  setBookmarkById: async (id, bookmark) => {
    const key = `bookmark:${id}`;
    return await cacheManager.set(key, bookmark, 3600); // 1 hour
  },

  invalidateBookmark: async (id) => {
    await cacheManager.delete(`bookmark:${id}`);
    await cacheManager.delete('all_tags');
    // Invalidate recent bookmarks
    for (let limit = 5; limit <= 50; limit += 5) {
      await cacheManager.delete(`recent_bookmarks:${limit}`);
    }
  }
};

// Cache warming functions
const warmCache = async () => {
  try {
    logger.info('Starting cache warming...');
    
    const db = require('./database');
    
    // Warm recent bookmarks
    const recentBookmarks = await db.query(`
      SELECT * FROM bookmarks 
      WHERE is_archived = FALSE 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    await bookmarkCache.setRecentBookmarks(recentBookmarks);

    // Warm tags
    const tags = await db.query(`
      SELECT t.*, COUNT(bt.bookmark_id) as bookmark_count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      GROUP BY t.id
      ORDER BY bookmark_count DESC
    `);
    await bookmarkCache.setTags(tags);

    logger.info('Cache warming completed');
  } catch (error) {
    logger.error('Cache warming failed', { error: error.message });
  }
};

module.exports = {
  cacheManager,
  cacheMiddleware,
  bookmarkCache,
  warmCache,
  CACHE_CONFIG
};