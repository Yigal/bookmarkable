// Migration: Initial database schema
// Created: 2024-01-01T00:00:00.000Z

module.exports = {
  async up(db) {
    // Create bookmarks table
    await db.query(`
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
      )
    `);

    // Create tags table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#6b7280',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create bookmark_tags junction table
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookmark_tags (
        bookmark_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (bookmark_id, tag_id),
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Create collections table
    await db.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3b82f6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create bookmark_collections junction table
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookmark_collections (
        bookmark_id INTEGER,
        collection_id INTEGER,
        PRIMARY KEY (bookmark_id, collection_id),
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await db.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(is_archived)');
  },
  
  async down(db) {
    // Drop indexes
    await db.query('DROP INDEX IF EXISTS idx_bookmarks_url');
    await db.query('DROP INDEX IF EXISTS idx_bookmarks_created_at');
    await db.query('DROP INDEX IF EXISTS idx_bookmarks_title');
    await db.query('DROP INDEX IF EXISTS idx_tags_name');
    await db.query('DROP INDEX IF EXISTS idx_bookmarks_archived');
    
    // Drop tables in reverse order
    await db.query('DROP TABLE IF EXISTS bookmark_collections');
    await db.query('DROP TABLE IF EXISTS collections');
    await db.query('DROP TABLE IF EXISTS bookmark_tags');
    await db.query('DROP TABLE IF EXISTS tags');
    await db.query('DROP TABLE IF EXISTS bookmarks');
  }
};