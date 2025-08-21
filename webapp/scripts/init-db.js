#!/usr/bin/env node
// Database initialization script

const db = require('../config/database');

const initializeDatabase = async () => {
  try {
    console.log('Initializing bookmark database...');
    
    await db.init();
    
    // Insert sample data for testing
    console.log('Adding sample bookmarks...');
    
    const sampleBookmarks = [
      {
        title: 'GitHub',
        url: 'https://github.com',
        description: 'Where the world builds software',
        tags: ['development', 'git', 'code']
      },
      {
        title: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
        description: 'Resources for developers, by developers',
        tags: ['documentation', 'web', 'javascript']
      },
      {
        title: 'Stack Overflow',
        url: 'https://stackoverflow.com',
        description: 'Where developers learn, share, and build careers',
        tags: ['development', 'community', 'help']
      }
    ];
    
    for (const bookmark of sampleBookmarks) {
      // Insert bookmark
      const result = await db.run(`
        INSERT INTO bookmarks (title, url, description)
        VALUES (?, ?, ?)
      `, [bookmark.title, bookmark.url, bookmark.description]);
      
      // Process tags
      for (const tagName of bookmark.tags) {
        // Insert tag if not exists
        await db.run(`
          INSERT OR IGNORE INTO tags (name) VALUES (?)
        `, [tagName]);
        
        // Get tag ID
        const tags = await db.query(
          'SELECT id FROM tags WHERE name = ?',
          [tagName]
        );
        
        if (tags.length > 0) {
          // Link bookmark to tag
          await db.run(`
            INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id)
            VALUES (?, ?)
          `, [result.id, tags[0].id]);
        }
      }
    }
    
    console.log('✅ Database initialized successfully with sample data');
    console.log('📊 Sample bookmarks added');
    
    // Show statistics
    const bookmarkCount = await db.query('SELECT COUNT(*) as count FROM bookmarks');
    const tagCount = await db.query('SELECT COUNT(*) as count FROM tags');
    
    console.log(`📚 Total bookmarks: ${bookmarkCount[0].count}`);
    console.log(`🏷️  Total tags: ${tagCount[0].count}`);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    db.close();
    process.exit(0);
  }
};

// Run initialization
initializeDatabase();
