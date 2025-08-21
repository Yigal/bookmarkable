// Jest setup file for global test configuration
const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // Use in-memory SQLite for tests
process.env.PORT = 0; // Use random available port for tests
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global test utilities
global.testUtils = {
  // Clean up test data
  cleanupDatabase: async (db) => {
    if (db && typeof db.query === 'function') {
      await db.query('DELETE FROM bookmark_tags');
      await db.query('DELETE FROM bookmarks');
      await db.query('DELETE FROM tags');
      await db.query('DELETE FROM collections');
      await db.query('DELETE FROM bookmark_collections');
    }
  },
  
  // Create test bookmark
  createTestBookmark: (overrides = {}) => ({
    title: 'Test Bookmark',
    url: 'https://example.com',
    description: 'Test description',
    favicon: 'https://example.com/favicon.ico',
    tags: ['test', 'example'],
    ...overrides
  }),
  
  // Create test user (for future auth implementation)
  createTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User',
    ...overrides
  }),
  
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Global test hooks
beforeEach(() => {
  // Reset any global state before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});