// Unit tests for database configuration
const database = require('../../config/database');
const fs = require('fs');
const path = require('path');

describe('Database Configuration', () => {
  let testDbPath;
  
  beforeEach(async () => {
    // Use in-memory database for tests
    testDbPath = ':memory:';
  });
  
  afterEach(async () => {
    // Close database connection after each test
    try {
      database.close();
    } catch (error) {
      // Ignore errors when closing
    }
  });
  
  describe('Database Initialization', () => {
    test('should initialize database with correct tables', async () => {
      await database.init(testDbPath);
      
      // Check if all required tables exist
      const tables = await database.query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      
      const tableNames = tables.map(table => table.name);
      
      expect(tableNames).toContain('bookmarks');
      expect(tableNames).toContain('tags');
      expect(tableNames).toContain('bookmark_tags');
      expect(tableNames).toContain('collections');
      expect(tableNames).toContain('bookmark_collections');
    });
    
    test('should enable foreign keys', async () => {
      await database.init(testDbPath);
      
      const result = await database.query('PRAGMA foreign_keys');
      expect(result[0].foreign_keys).toBe(1);
    });
    
    test('should throw error when initializing with invalid path', async () => {
      await expect(database.init('/invalid/path/database.db')).rejects.toThrow();
    });
  });
  
  describe('Database Operations', () => {
    beforeEach(async () => {
      await database.init(testDbPath);
    });
    
    test('should execute SELECT queries', async () => {
      const result = await database.query('SELECT 1 as test');
      expect(result).toHaveLength(1);
      expect(result[0].test).toBe(1);
    });
    
    test('should execute INSERT queries', async () => {
      const result = await database.run(
        'INSERT INTO bookmarks (title, url) VALUES (?, ?)',
        ['Test Title', 'https://example.com']
      );
      
      expect(result.id).toBeDefined();
      expect(result.changes).toBe(1);
    });
    
    test('should handle database transactions', async () => {
      const result = await database.transaction(async (db) => {
        await database.run(
          'INSERT INTO bookmarks (title, url) VALUES (?, ?)',
          ['Test Title 1', 'https://example1.com']
        );
        
        await database.run(
          'INSERT INTO bookmarks (title, url) VALUES (?, ?)',
          ['Test Title 2', 'https://example2.com']
        );
        
        return 'transaction complete';
      });
      
      expect(result).toBe('transaction complete');
      
      const bookmarks = await database.query('SELECT * FROM bookmarks');
      expect(bookmarks).toHaveLength(2);
    });
    
    test('should rollback failed transactions', async () => {
      try {
        await database.transaction(async (db) => {
          await database.run(
            'INSERT INTO bookmarks (title, url) VALUES (?, ?)',
            ['Test Title', 'https://example.com']
          );
          
          // This should cause a rollback
          throw new Error('Transaction failed');
        });
      } catch (error) {
        expect(error.message).toBe('Transaction failed');
      }
      
      const bookmarks = await database.query('SELECT * FROM bookmarks');
      expect(bookmarks).toHaveLength(0);
    });
  });
  
  describe('Connection Management', () => {
    test('should throw error when querying without initialization', async () => {
      await expect(database.query('SELECT 1')).rejects.toThrow(
        'Database not initialized. Call init() first.'
      );
    });
    
    test('should get connection after initialization', async () => {
      await database.init(testDbPath);
      const connection = database.getConnection();
      expect(connection).toBeDefined();
    });
    
    test('should close connection properly', async () => {
      await database.init(testDbPath);
      
      // This should not throw
      database.close();
      
      // After closing, queries should fail
      await expect(database.query('SELECT 1')).rejects.toThrow();
    });
  });
});