// Database configuration and initialization
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Pure functions for database operations
const createDatabasePath = (dbPath) => {
  const fullPath = path.resolve(dbPath || './data/bookmarks.db');
  const dir = path.dirname(fullPath);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return fullPath;
};

const createConnection = (dbPath) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
};

const executeQuery = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const executeInsert = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Database schema
const createTablesQuery = `
  -- Bookmarks table
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    favicon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    visit_count INTEGER DEFAULT 0,
    last_visited DATETIME
  );

  -- Tags table
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6b7280',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Junction table for bookmark-tag relationships
  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (bookmark_id, tag_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  -- Collections table for organizing bookmarks
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Junction table for bookmark-collection relationships
  CREATE TABLE IF NOT EXISTS bookmark_collections (
    bookmark_id INTEGER,
    collection_id INTEGER,
    PRIMARY KEY (bookmark_id, collection_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  );

  -- Indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
  CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
`;

// Database connection and operations
let dbConnection = null;

const database = {
  // Initialize database connection and create tables
  init: async (dbPath = process.env.DB_PATH) => {
    try {
      const fullPath = createDatabasePath(dbPath);
      dbConnection = await createConnection(fullPath);
      
      // Enable foreign keys
      await executeQuery(dbConnection, 'PRAGMA foreign_keys = ON');
      
      // Create tables
      await executeQuery(dbConnection, createTablesQuery);
      
      console.log('Database initialized at:', fullPath);
      return dbConnection;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  },

  // Get database connection
  getConnection: () => {
    if (!dbConnection) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return dbConnection;
  },

  // Close database connection
  close: () => {
    if (dbConnection) {
      dbConnection.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
      dbConnection = null;
    }
  },

  // Execute a query that returns rows
  query: async (sql, params = []) => {
    const db = database.getConnection();
    return await executeQuery(db, sql, params);
  },

  // Execute an insert/update/delete query
  run: async (sql, params = []) => {
    const db = database.getConnection();
    return await executeInsert(db, sql, params);
  },

  // Transaction wrapper
  transaction: async (callback) => {
    const db = database.getConnection();
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        Promise.resolve(callback(db))
          .then((result) => {
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve(result);
            });
          })
          .catch((error) => {
            db.run('ROLLBACK', (rollbackErr) => {
              reject(error);
            });
          });
      });
    });
  }
};

module.exports = database;
