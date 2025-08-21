// Integration tests for bookmarks API endpoints
const request = require('supertest');
const { createApp, configureMiddleware, configureRoutes } = require('../../server');
const database = require('../../config/database');

describe('Bookmarks API Integration Tests', () => {
  let app;
  let server;
  
  beforeAll(async () => {
    // Initialize test database
    await database.init(':memory:');
    
    // Create test app
    app = createApp();
    configureMiddleware(app);
    configureRoutes(app);
  });
  
  afterAll(async () => {
    // Clean up
    database.close();
    if (server) {
      server.close();
    }
  });
  
  beforeEach(async () => {
    // Clean database before each test
    await global.testUtils.cleanupDatabase(database);
  });
  
  describe('POST /api/bookmarks', () => {
    test('should create a new bookmark', async () => {
      const bookmarkData = global.testUtils.createTestBookmark();
      
      const response = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: bookmarkData.title,
        url: bookmarkData.url,
        description: bookmarkData.description
      });
      expect(response.body.data.id).toBeDefined();
    });
    
    test('should return 409 for duplicate URL', async () => {
      const bookmarkData = global.testUtils.createTestBookmark();
      
      // Create first bookmark
      await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData)
        .expect(201);
      
      // Try to create duplicate
      const response = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData)
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Bookmark already exists');
    });
    
    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
    
    test('should validate URL format', async () => {
      const bookmarkData = global.testUtils.createTestBookmark({
        url: 'invalid-url'
      });
      
      const response = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    test('should process tags correctly', async () => {
      const bookmarkData = global.testUtils.createTestBookmark({
        tags: ['javascript', 'tutorial', 'web-dev']
      });
      
      const response = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData)
        .expect(201);
      
      expect(response.body.data.tags).toHaveLength(3);
      expect(response.body.data.tags.map(t => t.name)).toEqual(
        expect.arrayContaining(['javascript', 'tutorial', 'web-dev'])
      );
    });
  });
  
  describe('GET /api/bookmarks', () => {
    beforeEach(async () => {
      // Create test bookmarks
      const bookmarks = [
        global.testUtils.createTestBookmark({
          title: 'JavaScript Tutorial',
          url: 'https://javascript.info',
          tags: ['javascript', 'tutorial']
        }),
        global.testUtils.createTestBookmark({
          title: 'React Documentation',
          url: 'https://reactjs.org',
          tags: ['react', 'documentation']
        }),
        global.testUtils.createTestBookmark({
          title: 'Node.js Guide',
          url: 'https://nodejs.org',
          tags: ['nodejs', 'backend']
        })
      ];
      
      for (const bookmark of bookmarks) {
        await request(app).post('/api/bookmarks').send(bookmark);
      }
    });
    
    test('should return all bookmarks', async () => {
      const response = await request(app)
        .get('/api/bookmarks')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toBeDefined();
    });
    
    test('should search bookmarks by title', async () => {
      const response = await request(app)
        .get('/api/bookmarks?q=JavaScript')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('JavaScript Tutorial');
    });
    
    test('should filter bookmarks by tags', async () => {
      const response = await request(app)
        .get('/api/bookmarks?tags=react')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('React Documentation');
    });
    
    test('should paginate results', async () => {
      const response = await request(app)
        .get('/api/bookmarks?limit=2&offset=1')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(1);
    });
  });
  
  describe('GET /api/bookmarks/recent', () => {
    test('should return recent bookmarks', async () => {
      // Create a bookmark
      const bookmarkData = global.testUtils.createTestBookmark();
      await request(app).post('/api/bookmarks').send(bookmarkData);
      
      const response = await request(app)
        .get('/api/bookmarks/recent')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
    
    test('should respect limit parameter', async () => {
      // Create multiple bookmarks
      for (let i = 0; i < 5; i++) {
        const bookmarkData = global.testUtils.createTestBookmark({
          title: `Bookmark ${i}`,
          url: `https://example${i}.com`
        });
        await request(app).post('/api/bookmarks').send(bookmarkData);
      }
      
      const response = await request(app)
        .get('/api/bookmarks/recent?limit=3')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });
  });
  
  describe('GET /api/bookmarks/:id', () => {
    test('should return specific bookmark', async () => {
      // Create a bookmark
      const bookmarkData = global.testUtils.createTestBookmark();
      const createResponse = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData);
      
      const bookmarkId = createResponse.body.data.id;
      
      const response = await request(app)
        .get(`/api/bookmarks/${bookmarkId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(bookmarkId);
      expect(response.body.data.title).toBe(bookmarkData.title);
    });
    
    test('should return 404 for non-existent bookmark', async () => {
      const response = await request(app)
        .get('/api/bookmarks/99999')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Bookmark not found');
    });
  });
  
  describe('PUT /api/bookmarks/:id', () => {
    test('should update bookmark', async () => {
      // Create a bookmark
      const bookmarkData = global.testUtils.createTestBookmark();
      const createResponse = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData);
      
      const bookmarkId = createResponse.body.data.id;
      
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        tags: ['updated', 'test']
      };
      
      const response = await request(app)
        .put(`/api/bookmarks/${bookmarkId}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.description).toBe('Updated description');
    });
    
    test('should return 404 for non-existent bookmark', async () => {
      const updateData = { title: 'Updated Title' };
      
      const response = await request(app)
        .put('/api/bookmarks/99999')
        .send(updateData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/bookmarks/:id', () => {
    test('should archive bookmark', async () => {
      // Create a bookmark
      const bookmarkData = global.testUtils.createTestBookmark();
      const createResponse = await request(app)
        .post('/api/bookmarks')
        .send(bookmarkData);
      
      const bookmarkId = createResponse.body.data.id;
      
      const response = await request(app)
        .delete(`/api/bookmarks/${bookmarkId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Bookmark archived successfully');
      
      // Verify bookmark is archived
      await request(app)
        .get(`/api/bookmarks/${bookmarkId}`)
        .expect(404);
    });
    
    test('should return 404 for non-existent bookmark', async () => {
      const response = await request(app)
        .delete('/api/bookmarks/99999')
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/bookmarks/tags', () => {
    test('should return all tags with counts', async () => {
      // Create bookmarks with tags
      const bookmarks = [
        global.testUtils.createTestBookmark({ tags: ['javascript', 'tutorial'] }),
        global.testUtils.createTestBookmark({ 
          url: 'https://example2.com', 
          tags: ['javascript', 'react'] 
        })
      ];
      
      for (const bookmark of bookmarks) {
        await request(app).post('/api/bookmarks').send(bookmark);
      }
      
      const response = await request(app)
        .get('/api/bookmarks/tags')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Find javascript tag
      const jsTag = response.body.data.find(tag => tag.name === 'javascript');
      expect(jsTag).toBeDefined();
      expect(jsTag.bookmark_count).toBe(2);
    });
  });
});