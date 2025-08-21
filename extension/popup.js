// Functional approach for handling popup state and operations
const PopupState = {
  currentTab: null,
  recentBookmarks: [],
  showingTags: false
};

// Pure functions for state management
const createBookmarkData = async (tab, tags = []) => {
  try {
    // Get enhanced page metadata from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMetadata' });
    
    if (response && response.success) {
      return {
        title: tab.title,
        url: tab.url,
        tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(t => t),
        timestamp: new Date().toISOString(),
        favicon: tab.favIconUrl,
        textContent: response.data.textContent || '',
        primaryImage: response.data.primaryImage || null,
        description: response.data.description || '',
        keywords: response.data.keywords || [],
        suggestedTags: response.data.suggestedTags || [],
        author: response.data.author || null,
        publishedDate: response.data.publishedDate || null,
        siteName: response.data.siteName || null
      };
    }
  } catch (error) {
    console.warn('Could not extract enhanced metadata:', error);
  }
  
  // Fallback to basic bookmark data
  return {
    title: tab.title,
    url: tab.url,
    tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(t => t),
    timestamp: new Date().toISOString(),
    favicon: tab.favIconUrl,
    textContent: '',
    primaryImage: null,
    description: '',
    keywords: [],
    suggestedTags: [],
    author: null,
    publishedDate: null,
    siteName: null
  };
};

const updateStatus = (message, type = 'default') => {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  return message;
};

const showTagsSection = (show) => {
  const tagsSection = document.getElementById('tags-section');
  const currentPageSection = document.querySelector('.current-page');
  
  if (show) {
    tagsSection.style.display = 'block';
    currentPageSection.style.opacity = '0.5';
    document.getElementById('tags-input').focus();
  } else {
    tagsSection.style.display = 'none';
    currentPageSection.style.opacity = '1';
    document.getElementById('tags-input').value = '';
  }
  
  return show;
};

const renderPageInfo = (tab) => {
  const titleElement = document.getElementById('page-title');
  const urlElement = document.getElementById('page-url');
  
  titleElement.textContent = tab.title || 'Untitled';
  urlElement.textContent = tab.url || '';
  
  return tab;
};

const renderBookmarksList = (bookmarks) => {
  const listElement = document.getElementById('bookmarks-list');
  
  if (!bookmarks || bookmarks.length === 0) {
    listElement.innerHTML = '<div class="loading">No recent bookmarks</div>';
    return bookmarks;
  }
  
  const bookmarksHtml = bookmarks.map(bookmark => {
    const syncIndicator = bookmark.syncStatus === 'synced' 
      ? '☁️' 
      : bookmark.syncStatus === 'pending'
      ? '⏳'
      : '💾';
    
    const textPreview = bookmark.textContent 
      ? `<div class="bookmark-preview">${bookmark.textContent.substring(0, 120)}${bookmark.textContent.length > 120 ? '...' : ''}</div>`
      : '';
    
    return `
      <div class="bookmark-item">
        <div class="bookmark-title">${bookmark.title} <span class="sync-indicator">${syncIndicator}</span></div>
        <div class="bookmark-url">${bookmark.url}</div>
        ${textPreview}
        <div class="bookmark-tags">
          ${(bookmark.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  listElement.innerHTML = bookmarksHtml;
  return bookmarks;
};

const enableButtons = (enabled) => {
  document.getElementById('save-bookmark').disabled = !enabled;
  document.getElementById('save-with-tags').disabled = !enabled;
  return enabled;
};

// Local storage functions
const saveBookmarkLocally = async (bookmarkData) => {
  try {
    // Get existing bookmarks
    const result = await chrome.storage.local.get(['bookmarks']);
    let bookmarks = result.bookmarks || [];
    
    // Check if bookmark already exists
    const exists = bookmarks.some(bookmark => bookmark.url === bookmarkData.url);
    if (exists) {
      // Find the existing bookmark to get its title
      const existingBookmark = bookmarks.find(bookmark => bookmark.url === bookmarkData.url);
      throw new Error(`Bookmark already exists: "${existingBookmark.title}"`); 
    }
    
    // Add ID and save
    const bookmarkWithId = {
      ...bookmarkData,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      syncStatus: 'pending' // Mark for sync when webapp is available
    };
    
    bookmarks.unshift(bookmarkWithId); // Add to beginning
    await chrome.storage.local.set({ bookmarks });
    
    return bookmarkWithId;
  } catch (error) {
    console.error('Error saving bookmark locally:', error);
    throw error;
  }
};

// API functions with fallback
const saveBookmarkToServer = async (bookmarkData) => {
  try {
    const response = await fetch('http://localhost:3000/api/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookmarkData)
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving bookmark to server:', error);
    throw error;
  }
};

const saveBookmarkWithFallback = async (bookmarkData) => {
  try {
    // Try server first
    const serverResult = await saveBookmarkToServer(bookmarkData);
    
    // Also save locally for offline access
    const localBookmark = {
      ...bookmarkData,
      id: serverResult.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
      syncStatus: 'synced'
    };
    
    const result = await chrome.storage.local.get(['bookmarks']);
    let bookmarks = result.bookmarks || [];
    
    // Remove existing local copy if any
    bookmarks = bookmarks.filter(b => b.url !== bookmarkData.url);
    bookmarks.unshift(localBookmark);
    
    await chrome.storage.local.set({ bookmarks });
    
    return { success: true, source: 'server', data: serverResult };
  } catch (error) {
    console.warn('Server unavailable, saving locally:', error.message);
    
    // Fallback to local storage
    try {
      const localResult = await saveBookmarkLocally(bookmarkData);
      return { success: true, source: 'local', data: localResult };
    } catch (localError) {
      // Handle duplicate bookmark error specially
      if (localError.message.includes('already exists')) {
        const existingTitle = localError.message.match(/"([^"]+)"/)?.[1] || 'Unknown';
        
        // Show option to add note instead
        const addNote = confirm(
          `This page is already bookmarked as "${existingTitle}". \n\n` +
          'Would you like to add a note to the existing bookmark?'
        );
        
        if (addNote) {
          const note = prompt('Add a note to this bookmark:');
          if (note !== null) { // User didn't cancel
            // Send message to background script to add note
            const response = await chrome.runtime.sendMessage({
              action: 'addNoteToBookmark',
              url: bookmarkData.url,
              note: note.trim()
            });
            
            if (response.success) {
              return { 
                ...response.bookmark, 
                message: response.message,
                noteAdded: true,
                success: true
              };
            } else {
              throw new Error('Failed to add note: ' + response.error);
            }
          }
        }
        
        throw new Error('Bookmark already exists');
      }
      
      throw localError;
    }
  }
};

const fetchRecentBookmarks = async (limit = 5) => {
  try {
    // Try server first
    const response = await fetch(`http://localhost:3000/api/bookmarks/recent?limit=${limit}`);
    
    if (response.ok) {
      const serverBookmarks = await response.json();
      
      // Update local storage with server data
      const result = await chrome.storage.local.get(['bookmarks']);
      let localBookmarks = result.bookmarks || [];
      
      // Merge server bookmarks with local ones
      serverBookmarks.forEach(serverBookmark => {
        const existingIndex = localBookmarks.findIndex(b => b.url === serverBookmark.url);
        if (existingIndex >= 0) {
          localBookmarks[existingIndex] = { ...serverBookmark, syncStatus: 'synced' };
        } else {
          localBookmarks.unshift({ ...serverBookmark, syncStatus: 'synced' });
        }
      });
      
      await chrome.storage.local.set({ bookmarks: localBookmarks });
      
      return serverBookmarks;
    }
  } catch (error) {
    console.warn('Server unavailable, using local bookmarks:', error.message);
  }
  
  // Fallback to local storage
  try {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    
    // Return most recent bookmarks (already sorted by insertion order)
    return bookmarks.slice(0, limit);
  } catch (error) {
    console.error('Error fetching local bookmarks:', error);
    return [];
  }
};

// Event handlers
const handleSaveBookmark = async (tab, tags = []) => {
  updateStatus('Saving bookmark...', 'loading');
  
  try {
    const bookmarkData = await createBookmarkData(tab, tags);
    const result = await saveBookmarkWithFallback(bookmarkData);
    
    if (result.noteAdded) {
      updateStatus('Note added to existing bookmark!', 'success');
    } else if (result.source === 'server') {
      updateStatus('Bookmark saved and synced!', 'success');
    } else {
      updateStatus('Bookmark saved locally!', 'success');
    }
    
    setTimeout(() => updateStatus('Ready'), 2000);
    
    // Refresh recent bookmarks
    const recentBookmarks = await fetchRecentBookmarks();
    renderBookmarksList(recentBookmarks);
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      updateStatus('Bookmark already exists', 'error');
    } else {
      updateStatus('Error saving bookmark', 'error');
    }
    setTimeout(() => updateStatus('Ready'), 3000);
  }
};

const handleSaveWithTags = () => {
  showTagsSection(true);
};

const handleConfirmSave = async () => {
  const tagsInput = document.getElementById('tags-input');
  const tags = tagsInput.value;
  
  await handleSaveBookmark(PopupState.currentTab, tags);
  showTagsSection(false);
};

const handleCancelTags = () => {
  showTagsSection(false);
};

const handleViewAll = () => {
  // Try webapp first, fallback to local bookmarks manager
  fetch('http://localhost:3000/api/bookmarks/recent?limit=1')
    .then(response => {
      if (response.ok) {
        chrome.tabs.create({ url: 'http://localhost:3000' });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
      }
    })
    .catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
    });
  
  window.close();
};

const handleSettings = () => {
  // TODO: Open settings page
  console.log('Settings clicked');
};

// Initialization
const initializePopup = async () => {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    PopupState.currentTab = tab;
    
    renderPageInfo(tab);
    enableButtons(true);
    
    // Fetch recent bookmarks
    updateStatus('Loading...', 'loading');
    const recentBookmarks = await fetchRecentBookmarks();
    PopupState.recentBookmarks = recentBookmarks;
    renderBookmarksList(recentBookmarks);
    updateStatus('Ready');
    
  } catch (error) {
    console.error('Error initializing popup:', error);
    updateStatus('Error loading', 'error');
  }
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Bind event handlers
  document.getElementById('save-bookmark').addEventListener('click', () => 
    handleSaveBookmark(PopupState.currentTab));
    
  document.getElementById('save-with-tags').addEventListener('click', handleSaveWithTags);
  document.getElementById('confirm-save').addEventListener('click', handleConfirmSave);
  document.getElementById('cancel-tags').addEventListener('click', handleCancelTags);
  document.getElementById('view-all').addEventListener('click', handleViewAll);
  document.getElementById('settings').addEventListener('click', handleSettings);
  
  // Handle Enter key in tags input
  document.getElementById('tags-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleConfirmSave();
    }
  });
  
  // Handle Escape key to cancel tags
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape' && PopupState.showingTags) {
      handleCancelTags();
    }
  });
  
  // Initialize the popup
  initializePopup();
});
