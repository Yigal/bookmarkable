// Bookmarks Page JavaScript - Fixed Version
// State management
const BookmarksState = {
  bookmarks: [],
  filteredBookmarks: [],
  selectedTags: [],
  currentFilter: 'all',
  currentSort: 'newest',
  searchQuery: ''
};

// Pure functions for data manipulation
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + ' days ago';
  if (days < 30) return Math.floor(days / 7) + ' weeks ago';
  if (days < 365) return Math.floor(days / 30) + ' months ago';
  
  return date.toLocaleDateString();
};

const extractDomainFromUrl = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const getFaviconUrl = (url) => {
  const domain = extractDomainFromUrl(url);
  return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=24';
};

const getFirstLetter = (text) => {
  return text ? text.charAt(0).toUpperCase() : '?';
};

const getAllTags = (bookmarks) => {
  const tagSet = new Set();
  bookmarks.forEach(bookmark => {
    if (bookmark.tags && Array.isArray(bookmark.tags)) {
      bookmark.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort();
};

const filterBookmarksByDate = (bookmarks, filter) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
  const monthAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

  switch (filter) {
    case 'today':
      return bookmarks.filter(b => new Date(b.timestamp) >= today);
    case 'week':
      return bookmarks.filter(b => new Date(b.timestamp) >= weekAgo);
    case 'month':
      return bookmarks.filter(b => new Date(b.timestamp) >= monthAgo);
    case 'bulk-save':
      return bookmarks.filter(b => b.tags && b.tags.includes('bulk-save'));
    default:
      return bookmarks;
  }
};

const filterBookmarksBySearch = (bookmarks, query) => {
  if (!query.trim()) return bookmarks;
  
  const searchLower = query.toLowerCase();
  return bookmarks.filter(bookmark => 
    bookmark.title.toLowerCase().includes(searchLower) ||
    bookmark.url.toLowerCase().includes(searchLower) ||
    (bookmark.tags && bookmark.tags.some(tag => 
      tag.toLowerCase().includes(searchLower)
    ))
  );
};

const filterBookmarksByTags = (bookmarks, selectedTags) => {
  if (selectedTags.length === 0) return bookmarks;
  
  return bookmarks.filter(bookmark => 
    selectedTags.every(tag => 
      bookmark.tags && bookmark.tags.includes(tag)
    )
  );
};

const sortBookmarks = (bookmarks, sortBy) => {
  const sorted = [...bookmarks];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'url':
      return sorted.sort((a, b) => a.url.localeCompare(b.url));
    default:
      return sorted;
  }
};

const applyFilters = (bookmarks, state) => {
  let filtered = filterBookmarksByDate(bookmarks, state.currentFilter);
  filtered = filterBookmarksBySearch(filtered, state.searchQuery);
  filtered = filterBookmarksByTags(filtered, state.selectedTags);
  return sortBookmarks(filtered, state.currentSort);
};

// Demo data for web page context
const getDemoBookmarks = () => {
  console.log('Creating demo bookmarks...');
  const demoData = [
    {
      id: 1,
      title: 'Fei - Your Autonomous Engineering Agent - AutonomyAI',
      url: 'https://autonomyai.io/fei/',
      description: 'Autonomous engineering agent for development workflows',
      favicon: 'https://autonomyai.io/favicon.ico',
      timestamp: new Date().toISOString(),
      tags: ['auto-captured', 'ai', 'development'],
      syncStatus: 'demo',
      textContent: 'Fei is an autonomous engineering agent that helps with development workflows and automation.',
      note: 'Demo bookmark for testing'
    },
    {
      id: 2,
      title: 'Best Practices for Building Agentic AI Systems: What Actually Works in Production - UserJot',
      url: 'https://userjot.com/blog/best-practices-building-agentic-ai-systems?utm_source=tldrai',
      description: 'Production-ready practices for building agentic AI systems',
      favicon: 'https://userjot.com/favicon.ico',
      timestamp: new Date().toISOString(),
      tags: ['ai', 'best-practices', 'production'],
      syncStatus: 'demo',
      textContent: 'Comprehensive guide on building agentic AI systems that actually work in production environments.',
      note: 'Essential reading for AI development'
    },
    {
      id: 3,
      title: 'Bookmarkable - Smart Chrome Extension',
      url: 'https://github.com/Yigal/bookmarkable',
      description: 'Smart bookmarking Chrome extension with visual previews',
      favicon: 'https://github.com/favicon.ico',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      tags: ['development', 'github', 'extension'],
      syncStatus: 'demo',
      textContent: 'This is a demonstration bookmark showing how the extension displays saved pages with clean formatting and metadata.',
      note: 'Demo bookmark for testing'
    }
  ];
  console.log('Demo bookmarks created:', demoData.length);
  return demoData;
};

// Local storage functions with sync capability
const fetchBookmarksFromStorage = async () => {
  try {
    // Try to sync with webapp first
    await attemptWebappSync();
  } catch (error) {
    console.warn('Webapp sync failed, using local data:', error.message);
  }
  
  // Check if Chrome APIs are available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('Chrome APIs not available, returning demo bookmarks array');
    return getDemoBookmarks();
  }
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      console.log('Local storage result:', result);
      const bookmarks = result.bookmarks || [];
      const finalBookmarks = Array.isArray(bookmarks) ? bookmarks : [bookmarks];
      console.log('Processed bookmarks from storage:', finalBookmarks);
      resolve(finalBookmarks);
    });
  });
};

// Attempt to sync with webapp and update local data
const attemptWebappSync = async () => {
  // Check if Chrome APIs are available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('Chrome APIs not available, skipping webapp sync');
    return { success: true, synced: false };
  }
  
  try {
    const response = await fetch('http://localhost:3000/api/bookmarks/recent?limit=100');
    if (response.ok) {
      const serverBookmarks = await response.json();
      
      // Get local bookmarks
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['bookmarks'], resolve);
      });
      
      let localBookmarks = result.bookmarks || [];
      let hasChanges = false;
      
      // Merge server bookmarks with local ones
      serverBookmarks.forEach(serverBookmark => {
        const existingIndex = localBookmarks.findIndex(b => b.url === serverBookmark.url);
        if (existingIndex >= 0) {
          // Update existing bookmark if it's different
          if (localBookmarks[existingIndex].syncStatus !== 'synced') {
            localBookmarks[existingIndex] = { ...serverBookmark, syncStatus: 'synced' };
            hasChanges = true;
          }
        } else {
          // Add new bookmark from server
          localBookmarks.unshift({ ...serverBookmark, syncStatus: 'synced' });
          hasChanges = true;
        }
      });
      
      // Save updated bookmarks if changes were made
      if (hasChanges) {
        await chrome.storage.local.set({ bookmarks: localBookmarks });
        console.log('Synced bookmarks with webapp');
      }
      
      return { success: true, synced: true };
    } else {
      throw new Error('Webapp not available');
    }
  } catch (error) {
    console.warn('Could not sync with webapp:', error.message);
    return { success: true, synced: false };
  }
};

// Text sanitization and utility functions
const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const sanitizeText = (text) => {
  if (!text) return '';
  
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  // Remove control characters and normalize whitespace
  const normalizedText = cleanText
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Filter out corrupted text patterns (but be less aggressive)
  if (normalizedText.includes('\\u')) return ''; // Contains Unicode escape sequences
  if (normalizedText.match(/^[\s\n\r]*$/)) return ''; // Only whitespace
  if (normalizedText.match(/^['\"]{3,}$/)) return ''; // Only multiple quotes
  if (normalizedText.includes('\'\"') && normalizedText.length < 10) return ''; // Contains corrupted quotes but only filter short strings
  
  return normalizedText;
};

const truncateText = (text, maxLength) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

const extractDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Clean up bookmark data
const cleanBookmarkData = (bookmark) => {
  return {
    ...bookmark,
    title: sanitizeText(bookmark.title) || 'Untitled',
    description: sanitizeText(bookmark.description),
    textContent: sanitizeText(bookmark.textContent),
    note: sanitizeText(bookmark.note),
    tags: Array.isArray(bookmark.tags) 
      ? bookmark.tags.map(tag => sanitizeText(tag)).filter(tag => tag)
      : []
  };
};

// UI rendering functions
const createBookmarkCard = (bookmark) => {
  const card = document.createElement('div');
  card.className = 'bookmark-card fade-in';
  
  // Sanitize all text content
  const title = sanitizeText(bookmark.title) || 'Untitled';
  const url = bookmark.url && isValidUrl(bookmark.url) ? bookmark.url : '#';
  const favicon = bookmark.favicon || getFaviconUrl(bookmark.url);
  const formattedDate = formatDate(bookmark.timestamp);
  const tags = Array.isArray(bookmark.tags) ? bookmark.tags.filter(tag => sanitizeText(tag)) : [];
  const note = sanitizeText(bookmark.note || '');
  const textContent = sanitizeText(bookmark.textContent || '');
  const primaryImage = bookmark.primaryImage;
  
  // Extract domain safely
  const domain = extractDomain(url) || '';
  
  // Create favicon element with proper error handling
  const faviconElement = document.createElement('img');
  faviconElement.src = favicon;
  faviconElement.alt = 'Favicon';
  faviconElement.className = 'bookmark-favicon';
  faviconElement.onerror = function() {
    const placeholder = document.createElement('div');
    placeholder.className = 'bookmark-favicon placeholder';
    placeholder.textContent = getFirstLetter(title);
    this.parentNode.replaceChild(placeholder, this);
  };
  
  // Create the card header
  const header = document.createElement('div');
  header.className = 'bookmark-header';
  
  const bookmarkInfo = document.createElement('div');
  bookmarkInfo.className = 'bookmark-info';
  
  const titleElement = document.createElement('h3');
  titleElement.className = 'bookmark-title';
  titleElement.title = title;
  const statusIcon = bookmark.syncStatus === 'synced' ? '☁️' : bookmark.syncStatus === 'pending' ? '⏳' : bookmark.syncStatus === 'demo' ? '🎯' : '💾';
  titleElement.textContent = title + ' ' + statusIcon;
  
  const domainElement = document.createElement('p');
  domainElement.className = 'bookmark-domain';
  domainElement.textContent = domain;
  
  const urlElement = document.createElement('p');
  urlElement.className = 'bookmark-url';
  urlElement.title = url;
  urlElement.textContent = url;
  
  bookmarkInfo.appendChild(titleElement);
  bookmarkInfo.appendChild(domainElement);
  bookmarkInfo.appendChild(urlElement);
  
  header.appendChild(faviconElement);
  header.appendChild(bookmarkInfo);
  
  card.appendChild(header);
  
  // Add image section if available
  if (primaryImage) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'bookmark-image';
    const img = document.createElement('img');
    img.src = primaryImage;
    img.alt = 'Page preview';
    img.loading = 'lazy';
    img.onerror = function() {
      this.parentElement.style.display = 'none';
    };
    imageDiv.appendChild(img);
    card.appendChild(imageDiv);
  }
  
  // Add text preview if available
  if (textContent) {
    const textDiv = document.createElement('div');
    textDiv.className = 'bookmark-text-preview';
    const textP = document.createElement('p');
    textP.textContent = truncateText(textContent, 300);
    textDiv.appendChild(textP);
    card.appendChild(textDiv);
  }
  
  // Add note if available
  if (note) {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'bookmark-note';
    noteDiv.title = note;
    noteDiv.textContent = note;
    card.appendChild(noteDiv);
  }
  
  // Add date
  const dateDiv = document.createElement('div');
  dateDiv.className = 'bookmark-date';
  dateDiv.textContent = formattedDate;
  card.appendChild(dateDiv);
  
  // Add tags if available
  if (tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'bookmark-tags';
    tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'bookmark-tag' + (tag === 'bulk-save' ? ' bulk-save' : '');
      tagSpan.textContent = tag;
      tagsDiv.appendChild(tagSpan);
    });
    card.appendChild(tagsDiv);
  }
  
  // Add actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'bookmark-actions';
  
  const visitBtn = document.createElement('button');
  visitBtn.className = 'action-btn visit';
  visitBtn.textContent = 'Visit';
  visitBtn.onclick = () => window.open(url, '_blank');
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn copy';
  copyBtn.textContent = 'Copy URL';
  copyBtn.onclick = () => copyToClipboard(url);
  
  actionsDiv.appendChild(visitBtn);
  actionsDiv.appendChild(copyBtn);
  card.appendChild(actionsDiv);
  
  return card;
};

const renderBookmarksGrid = (bookmarks) => {
  const grid = document.getElementById('bookmarks-grid');
  grid.innerHTML = '';
  
  if (bookmarks.length === 0) {
    showEmptyState();
    return;
  }
  
  bookmarks.forEach(bookmark => {
    grid.appendChild(createBookmarkCard(bookmark));
  });
};

const renderTagsList = (tags) => {
  const tagsList = document.getElementById('tags-list');
  tagsList.innerHTML = '';
  
  tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag-filter';
    tagElement.textContent = tag;
    tagElement.addEventListener('click', () => toggleTagFilter(tag));
    tagsList.appendChild(tagElement);
  });
};

const updateStats = (bookmarks) => {
  const totalCount = document.getElementById('total-count');
  const recentCount = document.getElementById('recent-count');
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const recentBookmarksCount = bookmarks.filter(b => 
    new Date(b.timestamp) >= weekAgo
  ).length;
  
  totalCount.textContent = bookmarks.length;
  recentCount.textContent = recentBookmarksCount;
};

// State management functions
const showLoadingState = () => {
  document.getElementById('loading-state').style.display = 'block';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('bookmarks-container').style.display = 'none';
};

const showErrorState = (message) => {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('bookmarks-container').style.display = 'none';
  document.getElementById('error-message').textContent = message;
};

const showEmptyState = () => {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('bookmarks-container').style.display = 'none';
};

const showBookmarksContainer = () => {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('bookmarks-container').style.display = 'block';
};

// Event handlers
const loadBookmarks = async () => {
  showLoadingState();
  
  try {
    // Load from local storage
    const rawBookmarks = await fetchBookmarksFromStorage();
    console.log('Loaded bookmarks from storage:', rawBookmarks.length);
    
    if (rawBookmarks.length === 0) {
      console.log('No bookmarks found');
      showEmptyState();
      return;
    }
    
    // Clean up corrupted bookmark data, but preserve demo bookmarks
    const bookmarks = rawBookmarks.map(bookmark => {
      // Don't over-sanitize demo bookmarks
      if (bookmark.syncStatus === 'demo') {
        return bookmark;
      }
      return cleanBookmarkData(bookmark);
    }).filter(bookmark => bookmark.title && bookmark.title.trim() !== '');
    
    console.log('Cleaned bookmarks:', bookmarks.length);
    
    if (bookmarks.length === 0) {
      console.log('All bookmarks were filtered out');
      showEmptyState();
      return;
    }
    
    BookmarksState.bookmarks = bookmarks;
    BookmarksState.filteredBookmarks = applyFilters(bookmarks, BookmarksState);
    
    updateStats(bookmarks);
    renderTagsList(getAllTags(bookmarks));
    renderBookmarksGrid(BookmarksState.filteredBookmarks);
    showBookmarksContainer();
    
    console.log('Bookmarks loaded successfully:', bookmarks.length, 'items');
    
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    
    // Provide different error messages based on context
    if (typeof chrome === 'undefined') {
      // For web page context, try to show demo bookmarks anyway
      try {
        console.log('Attempting to load demo bookmarks as fallback...');
        const demoBookmarks = getDemoBookmarks();
        BookmarksState.bookmarks = demoBookmarks;
        BookmarksState.filteredBookmarks = applyFilters(demoBookmarks, BookmarksState);
        
        updateStats(demoBookmarks);
        renderTagsList(getAllTags(demoBookmarks));
        renderBookmarksGrid(BookmarksState.filteredBookmarks);
        showBookmarksContainer();
        
        console.log('Demo bookmarks loaded as fallback');
        return;
      } catch (demoError) {
        console.error('Even demo bookmarks failed:', demoError);
        showErrorState('Demo mode: Unable to load demo bookmarks. This is a preview interface.');
      }
    } else {
      showErrorState('Unable to load bookmarks. Please try again later.');
    }
  }
};

const handleSearch = () => {
  const searchInput = document.getElementById('search-input');
  BookmarksState.searchQuery = searchInput.value;
  applyFiltersAndRender();
};

const handleSortChange = () => {
  const sortSelect = document.getElementById('sort-select');
  BookmarksState.currentSort = sortSelect.value;
  applyFiltersAndRender();
};

const handleFilterChange = () => {
  const filterSelect = document.getElementById('filter-select');
  BookmarksState.currentFilter = filterSelect.value;
  applyFiltersAndRender();
};

const toggleTagFilter = (tag) => {
  const index = BookmarksState.selectedTags.indexOf(tag);
  if (index > -1) {
    BookmarksState.selectedTags.splice(index, 1);
  } else {
    BookmarksState.selectedTags.push(tag);
  }
  
  // Update UI
  document.querySelectorAll('.tag-filter').forEach(tagElement => {
    if (tagElement.textContent === tag) {
      tagElement.classList.toggle('active');
    }
  });
  
  applyFiltersAndRender();
};

const clearAllFilters = () => {
  BookmarksState.selectedTags = [];
  BookmarksState.searchQuery = '';
  BookmarksState.currentFilter = 'all';
  BookmarksState.currentSort = 'newest';
  
  // Reset UI
  document.getElementById('search-input').value = '';
  document.getElementById('sort-select').value = 'newest';
  document.getElementById('filter-select').value = 'all';
  document.querySelectorAll('.tag-filter').forEach(tag => {
    tag.classList.remove('active');
  });
  
  applyFiltersAndRender();
};

const applyFiltersAndRender = () => {
  BookmarksState.filteredBookmarks = applyFilters(BookmarksState.bookmarks, BookmarksState);
  renderBookmarksGrid(BookmarksState.filteredBookmarks);
};

// Utility functions
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Copied to clipboard:', text);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing bookmarks...');
  loadBookmarks();
  
  // Set up event listeners
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }
  
  const filterSelect = document.getElementById('filter-select');
  if (filterSelect) {
    filterSelect.addEventListener('change', handleFilterChange);
  }
  
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', loadBookmarks);
  }
  
  const clearFiltersBtn = document.getElementById('clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
});

// Make utility functions globally available
window.copyToClipboard = copyToClipboard;