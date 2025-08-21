// Functional approach for handling popup state and operations
const PopupState = {
  currentTab: null,
  recentBookmarks: [],
  showingTags: false
};

// Pure functions for state management
const createBookmarkData = (tab, tags = []) => ({
  title: tab.title,
  url: tab.url,
  tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(t => t),
  timestamp: new Date().toISOString(),
  favicon: tab.favIconUrl
});

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
  
  const bookmarksHtml = bookmarks.map(bookmark => `
    <div class="bookmark-item">
      <div class="bookmark-title">${bookmark.title}</div>
      <div class="bookmark-url">${bookmark.url}</div>
      <div class="bookmark-tags">
        ${bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
    </div>
  `).join('');
  
  listElement.innerHTML = bookmarksHtml;
  return bookmarks;
};

const enableButtons = (enabled) => {
  document.getElementById('save-bookmark').disabled = !enabled;
  document.getElementById('save-with-tags').disabled = !enabled;
  return enabled;
};

// API functions
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
    console.error('Error saving bookmark:', error);
    throw error;
  }
};

const fetchRecentBookmarks = async (limit = 5) => {
  try {
    const response = await fetch(`http://localhost:3000/api/bookmarks/recent?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent bookmarks:', error);
    return [];
  }
};

// Event handlers
const handleSaveBookmark = async (tab, tags = []) => {
  updateStatus('Saving bookmark...', 'loading');
  
  try {
    const bookmarkData = createBookmarkData(tab, tags);
    await saveBookmarkToServer(bookmarkData);
    
    updateStatus('Bookmark saved!', 'success');
    setTimeout(() => updateStatus('Ready'), 2000);
    
    // Refresh recent bookmarks
    const recentBookmarks = await fetchRecentBookmarks();
    renderBookmarksList(recentBookmarks);
    
  } catch (error) {
    updateStatus('Error saving bookmark', 'error');
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
  chrome.tabs.create({ url: 'http://localhost:3000' });
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
