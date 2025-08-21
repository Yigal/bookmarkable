// Environment validation and configuration
const fs = require('fs');
const path = require('path');

// Required environment variables with their types and defaults
const environmentSchema = {
  // Server Configuration
  PORT: {
    type: 'number',
    default: 3000,
    description: 'Server port number'
  },
  NODE_ENV: {
    type: 'string',
    default: 'development',
    enum: ['development', 'test', 'staging', 'production'],
    description: 'Application environment'
  },
  
  // Database Configuration
  DB_PATH: {
    type: 'string',
    required: true,
    description: 'Database file path'
  },
  
  // Security Configuration
  SESSION_SECRET: {
    type: 'string',
    required: true,
    minLength: 16,
    description: 'Session secret for security'
  },
  CORS_ORIGINS: {
    type: 'string',
    default: 'chrome-extension://,http://localhost:3000',
    description: 'Allowed CORS origins (comma-separated)'
  },
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: {
    type: 'number',
    default: 900000, // 15 minutes
    description: 'Rate limit window in milliseconds'
  },
  RATE_LIMIT_MAX_REQUESTS: {
    type: 'number',
    default: 1000,
    description: 'Maximum requests per window'
  },
  
  // Logging Configuration
  LOG_LEVEL: {
    type: 'string',
    default: 'info',
    enum: ['error', 'warn', 'info', 'debug'],
    description: 'Logging level'
  },
  LOG_FORMAT: {
    type: 'string',
    default: 'combined',
    enum: ['combined', 'common', 'dev', 'short', 'tiny'],
    description: 'Logging format'
  },
  
  // Cache Configuration
  REDIS_URL: {
    type: 'string',
    default: null,
    description: 'Redis URL for caching (optional)'
  },
  CACHE_TTL: {
    type: 'number',
    default: 3600,
    description: 'Cache TTL in seconds'
  },
  
  // Monitoring Configuration
  HEALTH_CHECK_INTERVAL: {
    type: 'number',
    default: 30000,
    description: 'Health check interval in milliseconds'
  },
  METRICS_ENABLED: {
    type: 'boolean',
    default: false,
    description: 'Enable metrics collection'
  },
  
  // Feature Flags
  ENABLE_AUTH: {
    type: 'boolean',
    default: false,
    description: 'Enable authentication features'
  },
  ENABLE_ANALYTICS: {
    type: 'boolean',
    default: false,
    description: 'Enable analytics tracking'
  },
  ENABLE_EXPORT: {
    type: 'boolean',
    default: true,
    description: 'Enable bookmark export functionality'
  },
  
  // Development Configuration
  DEV_AUTO_RELOAD: {
    type: 'boolean',
    default: true,
    description: 'Enable auto-reload in development'
  },
  DEV_CORS_ALL_ORIGINS: {
    type: 'boolean',
    default: false,
    description: 'Allow all CORS origins in development'
  }
};

// Type conversion utilities
const convertValue = (value, type) => {
  if (value === null || value === undefined) return value;
  
  switch (type) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) throw new Error(`Invalid number: ${value}`);
      return num;
    
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      throw new Error(`Invalid boolean: ${value}`);
    
    case 'string':
      return String(value);
    
    default:
      return value;
  }
};

// Validation functions
const validateValue = (key, value, schema) => {
  const config = schema[key];
  
  // Check if required
  if (config.required && (value === null || value === undefined || value === '')) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  
  // Use default if value is missing
  if ((value === null || value === undefined || value === '') && config.default !== undefined) {
    value = config.default;
  }
  
  // Skip further validation if value is null/undefined
  if (value === null || value === undefined) return value;
  
  // Convert type
  try {
    value = convertValue(value, config.type);
  } catch (error) {
    throw new Error(`Invalid type for ${key}: ${error.message}`);
  }
  
  // Check enum values
  if (config.enum && !config.enum.includes(value)) {
    throw new Error(`Invalid value for ${key}: ${value}. Must be one of: ${config.enum.join(', ')}`);
  }
  
  // Check string length
  if (config.type === 'string' && config.minLength && value.length < config.minLength) {
    throw new Error(`${key} must be at least ${config.minLength} characters long`);
  }
  
  return value;
};

// Main validation function
const validateEnvironment = () => {
  const errors = [];
  const config = {};
  
  // Load and validate each environment variable
  for (const [key, schema] of Object.entries(environmentSchema)) {
    try {
      const rawValue = process.env[key];
      const validatedValue = validateValue(key, rawValue, { [key]: schema });
      config[key] = validatedValue;
    } catch (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }
  
  // Throw if there are validation errors
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
  
  return config;
};

// Environment info utility
const getEnvironmentInfo = () => {
  const config = validateEnvironment();
  
  return {
    nodeVersion: process.version,
    environment: config.NODE_ENV,
    port: config.PORT,
    databasePath: config.DB_PATH,
    logLevel: config.LOG_LEVEL,
    featuresEnabled: {
      auth: config.ENABLE_AUTH,
      analytics: config.ENABLE_ANALYTICS,
      export: config.ENABLE_EXPORT,
      metrics: config.METRICS_ENABLED
    },
    isDevelopment: config.NODE_ENV === 'development',
    isProduction: config.NODE_ENV === 'production',
    isTest: config.NODE_ENV === 'test'
  };
};

// Check if .env file exists and create from example if needed
const ensureEnvironmentFile = () => {
  const envPath = path.join(process.cwd(), '.env');
  const examplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    console.log('Creating .env file from .env.example...');
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ .env file created. Please review and update the configuration.');
  }
};

// Initialize environment configuration
const initializeEnvironment = () => {
  try {
    // Ensure .env file exists
    ensureEnvironmentFile();
    
    // Load environment variables from .env file
    require('dotenv').config();
    
    // Validate configuration
    const config = validateEnvironment();
    
    // Log environment info in development
    if (config.NODE_ENV === 'development') {
      console.log('🔧 Environment Configuration:');
      console.log(`   Node.js: ${process.version}`);
      console.log(`   Environment: ${config.NODE_ENV}`);
      console.log(`   Port: ${config.PORT}`);
      console.log(`   Database: ${config.DB_PATH}`);
      console.log(`   Log Level: ${config.LOG_LEVEL}`);
      console.log('');
    }
    
    return config;
  } catch (error) {
    console.error('❌ Environment configuration error:');
    console.error(error.message);
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }
};

module.exports = {
  validateEnvironment,
  getEnvironmentInfo,
  initializeEnvironment,
  environmentSchema
};