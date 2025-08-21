// Migration: Add user authentication tables
// Created: 2024-01-02T00:00:00.000Z

module.exports = {
  async up(db) {
    // Create users table for future authentication
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token TEXT,
        password_reset_token TEXT,
        password_reset_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Create user_sessions table for session management
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Add user_id to bookmarks table for user ownership
    await db.query(`
      ALTER TABLE bookmarks ADD COLUMN user_id INTEGER REFERENCES users(id)
    `);

    // Add user_id to collections table
    await db.query(`
      ALTER TABLE collections ADD COLUMN user_id INTEGER REFERENCES users(id)
    `);

    // Create indexes for performance
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id)');
  },
  
  async down(db) {
    // Drop indexes
    await db.query('DROP INDEX IF EXISTS idx_users_email');
    await db.query('DROP INDEX IF EXISTS idx_user_sessions_user_id');
    await db.query('DROP INDEX IF EXISTS idx_user_sessions_expires');
    await db.query('DROP INDEX IF EXISTS idx_bookmarks_user_id');
    await db.query('DROP INDEX IF EXISTS idx_collections_user_id');
    
    // Remove user_id columns (SQLite doesn't support DROP COLUMN, so we'd need to recreate tables)
    // For now, we'll just disable the foreign key constraints
    await db.query('PRAGMA foreign_keys = OFF');
    
    // Drop user-related tables
    await db.query('DROP TABLE IF EXISTS user_sessions');
    await db.query('DROP TABLE IF EXISTS users');
    
    // Re-enable foreign keys
    await db.query('PRAGMA foreign_keys = ON');
  }
};