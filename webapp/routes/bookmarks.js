// Bookmark routes following functional programming principles
const express = require('express');
const { body, query, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');

const router = express.Router();

// Pure functions for data processing
const sanitizeBookmarkData = (data) => ({
  title: data.title?.trim() || 'Untitled',
  url: data.url?.trim(),
  description: data.description?.trim() || null,
  favicon: data.favicon?.trim() || null,
  tags: Array.isArray(data.tags) ? data.tags : []
});

const formatBookmarkResponse = (bookmark, tags = []) => ({
  id: bookmark.id,
  title: bookmark.title,
  url: bookmark.url,
  description: bookmark.description,
  favicon: bookmark.favicon,
  tags: tags,
  createdAt: bookmark.created_at,
  updatedAt: bookmark.updated_at,
  isArchived: bookmark.is_archived,
  visitCount: bookmark.visit_count,
  lastVisited: bookmark.last_visited
});

const processTagsForBookmark = async (bookmarkId, tagNames) => {
  if (!Array.isArray(tagNames) || tagNames.length === 0) {
    return [];
  }

  const processedTags = [];
  
  for (const tagName of tagNames) {
    const trimmedName = tagName.trim();
    if (!trimmedName) continue;

    // Check if tag exists
    let existingTags = await db.query(
      'SELECT id, name FROM tags WHERE name = ?',
      [trimmedName]
    );

    let tagId;
    if (existingTags.length > 0) {
      tagId = existingTags[0].id;
    } else {
      // Create new tag
      const result = await db.run(
        'INSERT INTO tags (name) VALUES (?)',
        [trimmedName]
      );
      tagId = result.id;
    }

    // Link tag to bookmark
    await db.run(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
      [bookmarkId, tagId]
    );

    processedTags.push({ id: tagId, name: trimmedName });
  }

  return processedTags;
};

const getBookmarkTags = async (bookmarkId) => {
  const tags = await db.query(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `, [bookmarkId]);
  
  return tags;
};

// Validation rules
const bookmarkValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('url').isURL().withMessage('Valid URL is required'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('description').optional().trim()
];

const searchValidation = [
  query('q').optional().trim(),
  query('tags').optional(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
];

// Route handlers
const createBookmark = asyncHandler(async (req, res) => {
  const bookmarkData = sanitizeBookmarkData(req.body);
  
  // Check if bookmark already exists
  const existing = await db.query(
    'SELECT id FROM bookmarks WHERE url = ?',
    [bookmarkData.url]
  );
  
  if (existing.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Bookmark already exists',
      existingId: existing[0].id
    });
  }
  
  // Insert bookmark
  const result = await db.run(`
    INSERT INTO bookmarks (title, url, description, favicon)
    VALUES (?, ?, ?, ?)
  `, [bookmarkData.title, bookmarkData.url, bookmarkData.description, bookmarkData.favicon]);
  
  // Process tags
  const tags = await processTagsForBookmark(result.id, bookmarkData.tags);
  
  // Return formatted response
  const newBookmark = await db.query(
    'SELECT * FROM bookmarks WHERE id = ?',
    [result.id]
  );
  
  res.status(201).json({
    success: true,
    data: formatBookmarkResponse(newBookmark[0], tags)
  });
});

const getBookmarks = asyncHandler(async (req, res) => {
  const { q, tags, limit = 50, offset = 0 } = req.query;
  
  let query = `
    SELECT DISTINCT b.* FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
    WHERE b.is_archived = FALSE
  `;
  
  const params = [];
  
  // Add search conditions
  if (q) {
    query += ` AND (b.title LIKE ? OR b.description LIKE ? OR b.url LIKE ?)`;
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const placeholders = tagList.map(() => '?').join(',');
    query += ` AND t.name IN (${placeholders})`;
    params.push(...tagList);
  }
  
  query += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  
  const bookmarksResult = await db.query(query, params);
  
  // Get tags for each bookmark
  const bookmarksWithTags = await Promise.all(
    bookmarksResult.map(async (bookmark) => {
      const tags = await getBookmarkTags(bookmark.id);
      return formatBookmarkResponse(bookmark, tags);
    })
  );
  
  res.json({
    success: true,
    data: bookmarksWithTags,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: bookmarksWithTags.length
    }
  });
});

const getRecentBookmarks = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  const bookmarks = await db.query(`
    SELECT * FROM bookmarks 
    WHERE is_archived = FALSE 
    ORDER BY created_at DESC 
    LIMIT ?
  `, [limit]);
  
  const bookmarksWithTags = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const tags = await getBookmarkTags(bookmark.id);
      return formatBookmarkResponse(bookmark, tags);
    })
  );
  
  res.json({
    success: true,
    data: bookmarksWithTags
  });
});

const getBookmarkById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const bookmarks = await db.query(
    'SELECT * FROM bookmarks WHERE id = ? AND is_archived = FALSE',
    [id]
  );
  
  if (bookmarks.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Bookmark not found'
    });
  }
  
  const tags = await getBookmarkTags(id);
  
  res.json({
    success: true,
    data: formatBookmarkResponse(bookmarks[0], tags)
  });
});

const updateBookmark = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bookmarkData = sanitizeBookmarkData(req.body);
  
  // Update bookmark
  await db.run(`
    UPDATE bookmarks 
    SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [bookmarkData.title, bookmarkData.description, id]);
  
  // Update tags
  await db.run('DELETE FROM bookmark_tags WHERE bookmark_id = ?', [id]);
  const tags = await processTagsForBookmark(id, bookmarkData.tags);
  
  // Return updated bookmark
  const updatedBookmark = await db.query(
    'SELECT * FROM bookmarks WHERE id = ?',
    [id]
  );
  
  if (updatedBookmark.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Bookmark not found'
    });
  }
  
  res.json({
    success: true,
    data: formatBookmarkResponse(updatedBookmark[0], tags)
  });
});

const deleteBookmark = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await db.run(
    'UPDATE bookmarks SET is_archived = TRUE WHERE id = ?',
    [id]
  );
  
  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      message: 'Bookmark not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Bookmark archived successfully'
  });
});

const getAllTags = asyncHandler(async (req, res) => {
  const tags = await db.query(`
    SELECT t.*, COUNT(bt.bookmark_id) as bookmark_count
    FROM tags t
    LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
    LEFT JOIN bookmarks b ON bt.bookmark_id = b.id AND b.is_archived = FALSE
    GROUP BY t.id
    ORDER BY bookmark_count DESC, t.name
  `);
  
  res.json({
    success: true,
    data: tags
  });
});

// Routes
router.post('/', bookmarkValidation, handleValidationErrors, createBookmark);
router.get('/', searchValidation, handleValidationErrors, getBookmarks);
router.get('/recent', getRecentBookmarks);
router.get('/tags', getAllTags);
router.get('/:id', param('id').isInt(), handleValidationErrors, getBookmarkById);
router.put('/:id', param('id').isInt(), bookmarkValidation, handleValidationErrors, updateBookmark);
router.delete('/:id', param('id').isInt(), handleValidationErrors, deleteBookmark);

module.exports = router;
