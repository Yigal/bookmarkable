// Bookmarks Page JavaScript - Functional Programming Approach
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
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  
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
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=24`;
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

// Local storage functions
const fetchBookmarksFromStorage = async () => {
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

// UI rendering functions
const createBookmarkCard = (bookmark) => {
  const card = document.createElement('div');
  card.className = 'bookmark-card fade-in';
  
  const favicon = bookmark.favicon || getFaviconUrl(bookmark.url);
  const formattedDate = formatDate(bookmark.timestamp);
  const tags = bookmark.tags || [];
  const note = bookmark.note || '';
  
  // Extract domain from URL if not already present
  const domain = bookmark.domain || (bookmark.url ? new URL(bookmark.url).hostname : '');
  
  card.innerHTML = `
    <div class="bookmark-header">
      <img src="${favicon}" alt="Favicon" class="bookmark-favicon" 
           onerror="this.outerHTML='<div class=\\"bookmark-favicon placeholder\\">${getFirstLetter(bookmark.title)}</div>'">
      <div class="bookmark-info">
        <h3 class="bookmark-title" title="${bookmark.title}">${bookmark.title}</h3>
        <p class="bookmark-domain">${domain}</p>
        <p class="bookmark-url" title="${bookmark.url}">${bookmark.url}</p>
      </div>
    </div>
    ${note ? `<div class="bookmark-note" title="${note}">${note}</div>` : ''}
    <div class="bookmark-date">${formattedDate}</div>
    ${tags.length > 0 ? `
      <div class="bookmark-tags">
        ${tags.map(tag => `<span class="bookmark-tag ${tag === 'bulk-save' ? 'bulk-save' : ''}">${tag}</span>`).join('')}
      </div>
    ` : ''}
    <div class="bookmark-actions">
      <button class="action-btn visit" onclick="window.open('${bookmark.url}', '_blank')">Visit</button>
      <button class="action-btn copy" onclick="copyToClipboard('${bookmark.url}')">Copy URL</button>
    </div>
  `;
  
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
    const bookmarks = await fetchBookmarksFromStorage();
    console.log('Loaded bookmarks from local storage:', bookmarks.length);
    
    if (bookmarks.length === 0) {
      showEmptyState();
      return;
    }
    
    BookmarksState.bookmarks = bookmarks;
    BookmarksState.filteredBookmarks = applyFilters(bookmarks, BookmarksState);
    
    updateStats(bookmarks);
    renderTagsList(getAllTags(bookmarks));
    renderBookmarksGrid(BookmarksState.filteredBookmarks);
    showBookmarksContainer();
    
    console.log(`Bookmarks loaded from local storage: ${bookmarks.length} items`);
    
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showErrorState('Unable to load bookmarks. Please try again later.');
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

const exportBookmarks = () => {
  const dataStr = JSON.stringify(BookmarksState.bookmarks, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `bookmarks-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};

const showClearOptions = () => {
  const clearOptions = [
    { id: 'today', label: 'Clear Today', description: 'Remove bookmarks from today' },
    { id: 'week', label: 'Clear This Week', description: 'Remove bookmarks from this week' },
    { id: 'month', label: 'Clear This Month', description: 'Remove bookmarks from this month' },
    { id: 'all', label: 'Clear All', description: 'Remove all bookmarks' }
  ];
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'clear-modal-overlay';
  modal.innerHTML = `
    <div class="clear-modal">
      <h3>Clear Bookmarks</h3>
      <p>Choose what you want to clear:</p>
      <div class="clear-options">
        ${clearOptions.map(option => `
          <div class="clear-option" data-filter="${option.id}">
            <div class="clear-option-header">
              <span class="clear-option-label">${option.label}</span>
              <span class="clear-option-description">${option.description}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="clear-modal-actions">
        <button class="control-btn" id="cancel-clear">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelectorAll('.clear-option').forEach(option => {
    option.addEventListener('click', async () => {
      const filter = option.dataset.filter;
      const confirmed = confirm(`Are you sure you want to ${filter === 'all' ? 'clear all bookmarks' : `clear bookmarks from ${filter}`}? This action cannot be undone.`);
      
      if (confirmed) {
        try {
          const result = await chrome.runtime.sendMessage({
            action: 'clearBookmarks',
            timeFilter: filter
          });
          
          if (result.success) {
            alert(`Successfully cleared ${result.cleared} bookmarks. ${result.remaining} bookmarks remaining.`);
            // Refresh the bookmarks display
            loadBookmarks();
          } else {
            alert(`Error clearing bookmarks: ${result.error}`);
          }
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
        
        // Remove modal
        document.body.removeChild(modal);
      }
    });
  });
  
  // Cancel button
  modal.querySelector('#cancel-clear').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
};

// Utility functions
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    // Could show a toast notification here
    console.log('URL copied to clipboard');
  });
};

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Bind event listeners
  document.getElementById('search-input').addEventListener('input', handleSearch);
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('sort-select').addEventListener('change', handleSortChange);
  document.getElementById('filter-select').addEventListener('change', handleFilterChange);
  document.getElementById('refresh-btn').addEventListener('click', loadBookmarks);
  document.getElementById('export-btn').addEventListener('click', exportBookmarks);
  document.getElementById('clear-btn').addEventListener('click', showClearOptions);
  document.getElementById('retry-btn').addEventListener('click', loadBookmarks);
  document.getElementById('clear-search').addEventListener('click', clearAllFilters);
  
  // Handle Enter key in search
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });
  
  // Load bookmarks on page load
  loadBookmarks();
});

// Make functions available globally for HTML onclick handlers
window.copyToClipboard = copyToClipboard;
