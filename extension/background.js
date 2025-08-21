// Background service worker for Chrome extension
// Following functional programming principles

// Pure functions for data processing
const createBookmarkRecord = (tab, additionalData = {}) => {
  // Clean the title to remove HTML entities and normalize whitespace
  const cleanTitle = tab.title
    ?.replace(/&[a-zA-Z]+;/g, '') // Remove HTML entities like &quot;
    ?.replace(/\s+/g, ' ') // Replace multiple spaces with single space
    ?.trim() || 'Untitled';
  
  // Extract domain for better organization
  const url = new URL(tab.url);
  const domain = url.hostname;
  
  return {
    id: generateId(),
    title: cleanTitle,
    url: tab.url,
    domain: domain,
    favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${domain}`,
    timestamp: new Date().toISOString(),
    note: additionalData.note || '',
    ...additionalData
  };
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const formatApiEndpoint = (baseUrl, endpoint) => `${baseUrl}${endpoint}`;

// Storage functions
const saveToLocalStorage = async (key, data) => {
  try {
    // Get existing data first
    const existingResult = await chrome.storage.local.get([key]);
    let existingData = existingResult[key] || [];
    
    // Ensure existingData is an array
    if (!Array.isArray(existingData)) {
      existingData = existingData ? [existingData] : [];
    }
    
    // Add new data to existing array
    const updatedData = [...existingData, data];
    
    await chrome.storage.local.set({ [key]: updatedData });
    console.log(`Saved to local storage: ${key}`, updatedData.length, 'items');
    
    return { success: true, data: updatedData };
  } catch (error) {
    console.error('Error saving to storage:', error);
    return { success: false, error: error.message };
  }
};

const getFromLocalStorage = async (key) => {
  try {
    const result = await chrome.storage.local.get([key]);
    return { success: true, data: result[key] };
  } catch (error) {
    console.error('Error reading from storage:', error);
    return { success: false, error: error.message };
  }
};

// Local bookmark management functions
const checkIfBookmarkExists = async (url) => {
  try {
    const result = await getFromLocalStorage('bookmarks');
    if (result.success && result.data) {
      const bookmarks = Array.isArray(result.data) ? result.data : [result.data];
      const exists = bookmarks.some(bookmark => bookmark.url === url);
      return { success: true, exists, title: exists ? bookmarks.find(b => b.url === url)?.title : null };
    }
    return { success: true, exists: false };
  } catch (error) {
    console.error('Error checking bookmark existence:', error);
    return { success: false, error: error.message, exists: false };
  }
};

// Pre-load and cache icon data for instant updates
let cachedNormalIconPath = null;

const initializeIconCache = async () => {
  try {
    // Cache normal icon path
    cachedNormalIconPath = {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png", 
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    };
    
    console.log('Icon cache initialized successfully');
    
  } catch (error) {
    console.error('Error initializing icon cache:', error);
  }
};

const updateIconForTab = async (tabId, url) => {
  try {
    // Check if tab still exists
    await chrome.tabs.get(tabId);
  } catch (error) {
    console.log('Tab no longer exists, skipping icon update:', tabId);
    return;
  }
  
  const checkResult = await checkIfBookmarkExists(url);
  
  try {
    // Always use cached normal icon path for instant updates
    if (cachedNormalIconPath) {
      await chrome.action.setIcon({
        tabId: tabId,
        path: cachedNormalIconPath
      });
    }
    
    // Update the title instantly to show bookmark status
    const title = checkResult.exists 
      ? `✓ ${checkResult.title || 'Page already bookmarked'}` 
      : "Save Bookmark";
      
    await chrome.action.setTitle({
      tabId: tabId,
      title: title
    });
    
    // Add a badge to show saved status visually
    if (checkResult.exists) {
      await chrome.action.setBadgeText({
        tabId: tabId,
        text: "✓"
      });
      await chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: "#4CAF50"
      });
    } else {
      await chrome.action.setBadgeText({
        tabId: tabId,
        text: ""
      });
    }
  } catch (error) {
    console.error('Error updating icon:', error);
    // Fallback to just updating title
    try {
      const fallbackTitle = checkResult.exists 
        ? "✓ Page already bookmarked" 
        : "Save Bookmark";
        
      await chrome.action.setTitle({
        tabId: tabId,
        title: fallbackTitle
      });
    } catch (titleError) {
      console.error('Error updating title:', titleError);
    }
  }
};

const saveBookmarkLocally = async (bookmarkData) => {
  try {
    // Check if bookmark already exists
    const existsResult = await checkIfBookmarkExists(bookmarkData.url);
    if (existsResult.exists) {
      console.log('Bookmark already exists, skipping save:', bookmarkData.url);
      return { 
        success: false, 
        error: 'Bookmark already exists',
        alreadyExists: true,
        existingBookmark: existsResult.title
      };
    }
    
    // Clean the title to remove HTML entities and extra whitespace
    const cleanTitle = bookmarkData.title
      ?.replace(/&[a-zA-Z]+;/g, '') // Remove HTML entities like &quot;
      ?.replace(/\s+/g, ' ') // Replace multiple spaces with single space
      ?.trim() || 'Untitled';
    
    // Create clean bookmark data
    const cleanBookmarkData = {
      ...bookmarkData,
      title: cleanTitle,
      timestamp: new Date().toISOString()
    };
    
    // Save to main bookmarks storage
    const result = await saveToLocalStorage('bookmarks', cleanBookmarkData);
    console.log('Bookmark saved locally successfully:', result);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error saving bookmark locally:', error);
    return { success: false, error: error.message };
  }
};

const getBookmarksCount = async () => {
  try {
    const result = await getFromLocalStorage('bookmarks');
    if (result.success && result.data) {
      const bookmarks = Array.isArray(result.data) ? result.data : [result.data];
      return { success: true, count: bookmarks.length };
    }
    return { success: true, count: 0 };
  } catch (error) {
    console.error('Error getting bookmarks count:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

const clearBookmarksByTime = async (timeFilter) => {
  try {
    const result = await getFromLocalStorage('bookmarks');
    if (!result.success || !result.data) {
      return { success: true, cleared: 0, remaining: 0 };
    }
    
    let bookmarks = Array.isArray(result.data) ? result.data : [result.data];
    const originalCount = bookmarks.length;
    
    if (timeFilter === 'all') {
      // Clear all bookmarks
      await chrome.storage.local.remove(['bookmarks']);
      return { success: true, cleared: originalCount, remaining: 0 };
    }
    
    // Filter bookmarks to keep based on time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const monthAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    let bookmarksToKeep = [];
    
    switch (timeFilter) {
      case 'today':
        bookmarksToKeep = bookmarks.filter(b => new Date(b.timestamp) < today);
        break;
      case 'week':
        bookmarksToKeep = bookmarks.filter(b => new Date(b.timestamp) < weekAgo);
        break;
      case 'month':
        bookmarksToKeep = bookmarks.filter(b => new Date(b.timestamp) < monthAgo);
        break;
      default:
        return { success: false, error: 'Invalid time filter', cleared: 0, remaining: originalCount };
    }
    
    const clearedCount = originalCount - bookmarksToKeep.length;
    
    if (clearedCount > 0) {
      await chrome.storage.local.set({ bookmarks: bookmarksToKeep });
    }
    
    return { 
      success: true, 
      cleared: clearedCount, 
      remaining: bookmarksToKeep.length,
      timeFilter 
    };
    
  } catch (error) {
    console.error('Error clearing bookmarks:', error);
    return { success: false, error: error.message, cleared: 0, remaining: 0 };
  }
};

const showNoteInputPopup = async (tab) => {
  try {
    // Validate tab
    if (!tab || !tab.id || !tab.url) {
      console.error('Invalid tab data:', tab);
      return false;
    }
    
    // Check if tab is still valid
    try {
      await chrome.tabs.get(tab.id);
    } catch (error) {
      console.error('Tab no longer exists:', tab.id);
      return false;
    }
    
    console.log('Showing note popup for tab:', tab.id, tab.url);
    
    // Inject the note input popup into the current tab
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      css: `
        .bookmark-note-popup {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 350px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          border: 1px solid #e1e5e9;
          animation: slideInRight 0.3s ease-out;
        }
        
        .bookmark-note-popup-header {
          padding: 16px 16px 12px 16px;
          border-bottom: 1px solid #e1e5e9;
          background: #f8fafc;
          border-radius: 8px 8px 0 0;
        }
        
        .bookmark-note-popup-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }
        
        .bookmark-note-popup-subtitle {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: #6b7280;
        }
        
        .bookmark-note-popup-body {
          padding: 16px;
        }
        
        .bookmark-note-input {
          width: 100%;
          min-height: 80px;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .bookmark-note-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .bookmark-note-popup-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 12px;
        }
        
        .bookmark-note-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .bookmark-note-btn-primary {
          background: #3b82f6;
          color: white;
        }
        
        .bookmark-note-btn-primary:hover {
          background: #2563eb;
        }
        
        .bookmark-note-btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        
        .bookmark-note-btn-secondary:hover {
          background: #e5e7eb;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .bookmark-note-popup.closing {
          animation: slideOutRight 0.3s ease-in forwards;
        }
      `
    });
    
    // Create and inject the popup HTML
    const popupHTML = `
      <div class="bookmark-note-popup" id="bookmark-note-popup">
        <div class="bookmark-note-popup-header">
          <h3 class="bookmark-note-popup-title">Add Note to Bookmark</h3>
          <p class="bookmark-note-popup-subtitle">${tab.title}</p>
        </div>
        <div class="bookmark-note-popup-body">
          <textarea 
            class="bookmark-note-input" 
            id="bookmark-note-input"
            placeholder="Enter a note about this page (optional)..."
            maxlength="500"
          ></textarea>
          <div class="bookmark-note-popup-actions">
            <button class="bookmark-note-btn bookmark-note-btn-secondary" id="bookmark-note-cancel">Cancel</button>
            <button class="bookmark-note-btn bookmark-note-btn-primary" id="bookmark-note-save">Save</button>
          </div>
        </div>
      </div>
    `;
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (popupHTML, tabId) => {
        // Remove any existing popup
        const existingPopup = document.getElementById('bookmark-note-popup');
        if (existingPopup) {
          existingPopup.remove();
        }
        
        // Insert the popup
        document.body.insertAdjacentHTML('beforeend', popupHTML);
        
        const popup = document.getElementById('bookmark-note-popup');
        const input = document.getElementById('bookmark-note-input');
        const saveBtn = document.getElementById('bookmark-note-save');
        const cancelBtn = document.getElementById('bookmark-note-cancel');
        
        let noteSubmitted = false;
        let autoCloseTimer;
        
        // Auto-close after 3 seconds if no input
        const startAutoCloseTimer = () => {
          autoCloseTimer = setTimeout(() => {
            if (!noteSubmitted && !input.value.trim()) {
              closePopup();
            }
          }, 3000);
        };
        
        // Reset timer on input
        input.addEventListener('input', () => {
          clearTimeout(autoCloseTimer);
          if (input.value.trim()) {
            startAutoCloseTimer();
          }
        });
        
        // Focus input and start timer
        input.focus();
        startAutoCloseTimer();
        
        // Save button click
        saveBtn.addEventListener('click', () => {
          noteSubmitted = true;
          const note = input.value.trim();
          closePopup();
          
          // Send message to background script
          chrome.runtime.sendMessage({
            action: 'noteSubmitted',
            note: note,
            tabId: tabId
          });
        });
        
        // Cancel button click
        cancelBtn.addEventListener('click', () => {
          noteSubmitted = true;
          closePopup();
          
          // Send message to background script
          chrome.runtime.sendMessage({
            action: 'noteSubmitted',
            note: '',
            tabId: tabId
          });
        });
        
        // Enter key to save
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveBtn.click();
          }
        });
        
        // Escape key to cancel
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelBtn.click();
          }
        });
        
        function closePopup() {
          popup.classList.add('closing');
          setTimeout(() => {
            if (popup.parentNode) {
              popup.remove();
            }
          }, 300);
        }
      },
      args: [popupHTML, tab.id]
    });
    
    return true;
    
  } catch (error) {
    console.error('Error showing note input popup:', error);
    return false;
  }
};

const saveAllOpenTabs = async () => {
  try {
    // Get all tabs except chrome:// pages
    const tabs = await chrome.tabs.query({});
    const validTabs = tabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('moz-extension://')
    );
    
    if (validTabs.length === 0) {
      return { success: false, error: 'No valid tabs to save', saved: 0, failed: 0 };
    }
    
    let savedCount = 0;
    let failedCount = 0;
    const results = [];
    
    // Save each tab as a bookmark
    for (const tab of validTabs) {
      const bookmarkData = createBookmarkRecord(tab, { 
        tags: ['bulk-save', `saved-${new Date().toISOString().split('T')[0]}`] 
      });
      
      const result = await saveBookmarkLocally(bookmarkData);
      
          if (result.success) {
      savedCount++;
      // Update icon for successfully saved tabs
      await updateIconForTab(tab.id, tab.url);
    } else if (result.alreadyExists) {
      // Bookmark already exists, show notification
      const settingsResult = await getFromLocalStorage('settings');
      const showNotifications = settingsResult.data?.showNotifications !== false;
      
      if (showNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Bookmark Already Exists',
          message: `"${result.existingBookmark}" is already saved.`
        });
      }
    } else {
      failedCount++;
    }
      
      results.push({ 
        tab: { title: tab.title, url: tab.url }, 
        result: result.success,
        error: result.error 
      });
    }
    
    return {
      success: true,
      saved: savedCount,
      failed: failedCount,
      total: validTabs.length,
      results
    };
    
  } catch (error) {
    console.error('Error saving all tabs:', error);
    return { success: false, error: error.message, saved: 0, failed: 0 };
  }
};

// Function to create context menu items
const createContextMenus = () => {
  console.log('Creating context menus...');
  
  // Remove existing menus first to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    console.log('Existing menus removed, creating new ones...');
    
    // Create context menu items for page context
    chrome.contextMenus.create({
      id: 'saveBookmark',
      title: 'Save to Bookmark Sync',
      contexts: ['page', 'link']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating saveBookmark menu:', chrome.runtime.lastError);
      } else {
        console.log('saveBookmark menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'saveAllTabs',
      title: 'Save All Tabs to Bookmark Sync',
      contexts: ['page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating saveAllTabs menu:', chrome.runtime.lastError);
      } else {
        console.log('saveAllTabs menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'viewBookmarks',
      title: 'View All Bookmarks',
      contexts: ['page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating viewBookmarks menu:', chrome.runtime.lastError);
      } else {
        console.log('viewBookmarks menu created successfully');
      }
    });
    
    // Create context menu items for extension icon (action context)
    chrome.contextMenus.create({
      id: 'viewBookmarksFromIcon',
      title: 'View All Bookmarks',
      contexts: ['action']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating viewBookmarksFromIcon menu:', chrome.runtime.lastError);
      } else {
        console.log('viewBookmarksFromIcon menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'saveCurrentTabFromIcon',
      title: 'Save Current Tab',
      contexts: ['action']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating saveCurrentTabFromIcon menu:', chrome.runtime.lastError);
      } else {
        console.log('saveCurrentTabFromIcon menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'saveAllTabsFromIcon',
      title: 'Save All Tabs',
      contexts: ['action']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating saveAllTabsFromIcon menu:', chrome.runtime.lastError);
      } else {
        console.log('saveAllTabsFromIcon menu created successfully');
      }
    });
    
    // Create clear bookmarks submenu
    chrome.contextMenus.create({
      id: 'clearBookmarks',
      title: 'Clear Bookmarks',
      contexts: ['action']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating clearBookmarks menu:', chrome.runtime.lastError);
      } else {
        console.log('clearBookmarks menu created successfully');
      }
    });
    
    // Create clear bookmarks submenu items
    chrome.contextMenus.create({
      id: 'clearToday',
      title: 'Clear Today',
      contexts: ['action'],
      parentId: 'clearBookmarks'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating clearToday menu:', chrome.runtime.lastError);
      } else {
        console.log('clearToday menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'clearWeek',
      title: 'Clear This Week',
      contexts: ['action'],
      parentId: 'clearBookmarks'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating clearWeek menu:', chrome.runtime.lastError);
      } else {
        console.log('clearWeek menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'clearMonth',
      title: 'Clear This Month',
      contexts: ['action'],
      parentId: 'clearBookmarks'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating clearMonth menu:', chrome.runtime.lastError);
      } else {
        console.log('clearMonth menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'clearAll',
      title: 'Clear All Bookmarks',
      contexts: ['action'],
      parentId: 'clearBookmarks'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating clearAll menu:', chrome.runtime.lastError);
      } else {
        console.log('clearAll menu created successfully');
      }
    });
    
    console.log('Context menus creation completed');
  });
};

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Bookmark Sync extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    saveToLocalStorage('settings', {
      autoSave: true,
      showNotifications: true,
      keyboardShortcuts: true,
      bulkOperations: true
    });
  }
  
  // Initialize icon cache immediately for instant updates
  await initializeIconCache();
  
  // Create context menu items
  createContextMenus();
});

// Keyboard command handlers
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || tab.url.startsWith('chrome://')) {
      return;
    }
    
    switch (command) {
      case 'save-bookmark':
        await handleQuickSave(tab);
        break;
        
      case 'save-with-tags':
        await handleSaveWithTags(tab);
        break;
        
      case 'open-bookmarks':
        await chrome.tabs.create({ url: 'http://localhost:3000' });
        break;
    }
  } catch (error) {
    console.error('Error handling keyboard command:', command, error);
  }
});

// Quick save handler
const handleQuickSave = async (tab) => {
  const bookmarkData = createBookmarkRecord(tab, { 
    tags: ['quick-save'],
    source: 'keyboard-shortcut'
  });
  
  const result = await saveBookmarkLocally(bookmarkData);
  
  if (result.success) {
    await updateIconForTab(tab.id, tab.url);
    
    // Show notification
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Quick Save',
        message: `Saved: ${tab.title}`,
        priority: 1
      });
    }
  }
};

// Save with tags handler
const handleSaveWithTags = async (tab) => {
  try {
    await showNoteInputPopup(tab);
  } catch (error) {
    console.error('Error showing tags popup:', error);
    // Fallback to quick save
    await handleQuickSave(tab);
  }
};

chrome.runtime.onStartup.addListener(async () => {
  console.log('Bookmark Sync extension started');
  
  // Initialize icon cache first for maximum speed
  await initializeIconCache();
  
  // Create context menu items (ensure they exist)
  createContextMenus();
  
  // Update icons for all open tabs with cached data
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        await updateIconForTab(tab.id, tab.url);
      }
    }
  } catch (error) {
    console.error('Error updating icons on startup:', error);
  }
});

// Tab change listeners to update icon based on bookmark status
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Ensure icon cache is ready
    if (!cachedNormalIconPath) {
      await initializeIconCache();
    }
    
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://')) {
      await updateIconForTab(tab.id, tab.url);
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      // Ensure icon cache is ready
      if (!cachedNormalIconPath) {
        await initializeIconCache();
      }
      
      await updateIconForTab(tabId, tab.url);
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }
});

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleMessage = async () => {
    switch (request.action) {
      case 'createContextMenus':
        createContextMenus();
        return { success: true, message: 'Context menus created' };
        
      case 'saveBookmark':
        const bookmarkData = createBookmarkRecord(request.tab, request.data);
        const result = await saveBookmarkLocally(bookmarkData);
        return result;
        
      case 'getRecentBookmarks':
        try {
          const result = await getFromLocalStorage('bookmarks');
          if (result.success && result.data) {
            const bookmarks = Array.isArray(result.data) ? result.data : [result.data];
            // Return most recent bookmarks
            const recentBookmarks = bookmarks
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, 5);
            return { success: true, data: recentBookmarks };
          }
          return { success: true, data: [] };
        } catch (error) {
          return { success: false, error: error.message };
        }
        
      case 'pageIdle':
        // Handle auto-capture when user has been idle on a page
        const tab = sender.tab;
        if (tab && tab.url && request.data) {
          // Get user settings to check if auto-save is enabled
          const settingsResult = await getFromLocalStorage('settings');
          const autoSaveEnabled = settingsResult.data?.autoSave !== false;
          
          if (autoSaveEnabled) {
            // Check if page is already bookmarked
            const existsResult = await checkIfBookmarkExists(tab.url);
            
            if (!existsResult.exists) {
              // Auto-save the bookmark with enhanced metadata
              const enhancedBookmarkData = createBookmarkRecord(tab, {
                ...request.data,
                tags: ['auto-captured', ...request.data.suggestedTags || []],
                captureReason: 'idle-detection'
              });
              
              const result = await saveBookmarkLocally(enhancedBookmarkData);
              
              if (result.success) {
                // Update icon to show saved state
                await updateIconForTab(tab.id, tab.url);
                
                // Show subtle notification for auto-captured bookmarks
                const showNotifications = settingsResult.data?.showNotifications !== false;
                if (showNotifications) {
                  chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'Auto-Captured Bookmark',
                    message: `Saved: ${tab.title}`,
                    priority: 0 // Lower priority for auto-captures
                  });
                }
              }
              
              return result;
            }
          }
        }
        return { success: true, message: 'Auto-capture skipped' };
        
      case 'getBookmarksCount':
        return await getBookmarksCount();
        
      case 'clearBookmarks':
        return await clearBookmarksByTime(request.timeFilter);
        
      case 'noteSubmitted':
        // Handle note submission from popup
        const noteTab = await chrome.tabs.get(request.tabId);
        if (noteTab) {
          const bookmarkData = createBookmarkRecord(noteTab, { note: request.note });
          const result = await saveBookmarkLocally(bookmarkData);
          
          // Update icon
          if (result.success || result.alreadyExists) {
            await updateIconForTab(noteTab.id, noteTab.url);
          }
          
          // Show notification
          const settingsResult = await getFromLocalStorage('settings');
          const showNotifications = settingsResult.data?.showNotifications !== false;
          
          if (showNotifications) {
            if (result.success) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Bookmark Saved',
                message: request.note ? `Saved with note: ${noteTab.title}` : `Saved: ${noteTab.title}`,
                priority: 0
              });
            } else if (result.alreadyExists) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Bookmark Already Exists',
                message: `"${result.existingBookmark}" is already saved.`,
                priority: 0
              });
            }
          }
          
          return result;
        }
        return { success: false, error: 'Tab not found' };
        
      case 'getSettings':
        return await getFromLocalStorage('settings');
        
      case 'updateSettings':
        return await saveToLocalStorage('settings', request.settings);
        
      default:
        return { success: false, error: 'Unknown action' };
    }
  };
  
  // Handle async responses
  handleMessage().then(sendResponse);
  return true; // Keep message channel open for async response
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveBookmark') {
    const url = info.linkUrl || tab.url;
    const title = info.linkUrl ? info.selectionText || 'Link' : tab.title;
    
    const bookmarkData = createBookmarkRecord({ 
      ...tab, 
      url: url, 
      title: title 
    });
    
    const result = await saveBookmarkLocally(bookmarkData);
    
    // Update icon if we saved the current tab's URL
    if (result.success && url === tab.url) {
      await updateIconForTab(tab.id, tab.url);
    }
    
    // Show notification if enabled
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmark Sync',
        message: result.success ? 'Bookmark saved!' : 'Failed to save bookmark'
      });
    }
  } else if (info.menuItemId === 'saveAllTabs') {
    // Get settings to check if notifications are enabled
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    // Show initial notification
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmark Sync',
        message: 'Saving all tabs... This may take a moment.'
      });
    }
    
    // Save all tabs
    const result = await saveAllOpenTabs();
    
    // Show completion notification
    if (showNotifications) {
      const message = result.success 
        ? `Successfully saved ${result.saved} tabs${result.failed > 0 ? ` (${result.failed} failed)` : ''}` 
        : `Failed to save tabs: ${result.error}`;
        
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmark Sync - Bulk Save Complete',
        message: message
      });
    }
    
    console.log('Save all tabs result:', result);
  } else if (info.menuItemId === 'viewBookmarks') {
    // Open the local bookmarks page
    chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
  } else if (info.menuItemId === 'viewBookmarksFromIcon') {
    // Open the local bookmarks page from icon context menu
    chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
  } else if (info.menuItemId === 'saveCurrentTabFromIcon') {
    // Save current tab from icon context menu
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab[0]) {
      const bookmarkData = createBookmarkRecord(tab[0]);
      const result = await saveBookmarkLocally(bookmarkData);
      
      if (result.success) {
        await updateIconForTab(tab[0].id, tab[0].url);
        
        // Show notification if enabled
        const settingsResult = await getFromLocalStorage('settings');
        const showNotifications = settingsResult.data?.showNotifications !== false;
        
        if (showNotifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Bookmark Sync',
            message: result.success ? 'Bookmark saved!' : 'Failed to save bookmark'
          });
        }
      }
    }
  } else if (info.menuItemId === 'saveAllTabsFromIcon') {
    // Save all tabs from icon context menu
    const result = await saveAllOpenTabs();
    
    // Show notification if enabled
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      const message = result.success 
        ? `Successfully saved ${result.saved} tabs${result.failed > 0 ? ` (${result.failed} failed)` : ''}` 
        : `Failed to save tabs: ${result.error}`;
        
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmark Sync - Bulk Save Complete',
        message: message
      });
    }
    
    console.log('Save all tabs result:', result);
  } else if (info.menuItemId === 'clearToday') {
    // Clear today's bookmarks
    const result = await clearBookmarksByTime('today');
    console.log('Clear today result:', result);
    
    // Show notification
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmarks Cleared',
        message: `Cleared ${result.cleared} bookmarks from today. ${result.remaining} bookmarks remaining.`
      });
    }
  } else if (info.menuItemId === 'clearWeek') {
    // Clear this week's bookmarks
    const result = await clearBookmarksByTime('week');
    console.log('Clear week result:', result);
    
    // Show notification
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmarks Cleared',
        message: `Cleared ${result.cleared} bookmarks from this week. ${result.remaining} bookmarks remaining.`
      });
    }
  } else if (info.menuItemId === 'clearMonth') {
    // Clear this month's bookmarks
    const result = await clearBookmarksByTime('month');
    console.log('Clear month result:', result);
    
    // Show notification
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmarks Cleared',
        message: `Cleared ${result.cleared} bookmarks from this month. ${result.remaining} bookmarks remaining.`
      });
    }
  } else if (info.menuItemId === 'clearAll') {
    // Clear all bookmarks
    const result = await clearBookmarksByTime('all');
    console.log('Clear all result:', result);
    
    // Show notification
    const settingsResult = await getFromLocalStorage('settings');
    const showNotifications = settingsResult.data?.showNotifications !== false;
    
    if (showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'All Bookmarks Cleared',
        message: `Cleared all ${result.cleared} bookmarks.`
      });
    }
  }
});

// Handle extension icon click to automatically save bookmark
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('Extension icon clicked for tab:', tab.id, tab.url);
    
    // Check if bookmark already exists
    const existsResult = await checkIfBookmarkExists(tab.url);
    console.log('Bookmark exists check:', existsResult);
    
    if (existsResult.exists) {
      // Bookmark already exists, show notification
      const settingsResult = await getFromLocalStorage('settings');
      const showNotifications = settingsResult.data?.showNotifications !== false;
      
      if (showNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Bookmark Already Exists',
          message: `"${existsResult.title}" is already saved.`
        });
      }
      
      // Update icon to show bookmark exists
      await updateIconForTab(tab.id, tab.url);
      return;
    }
    
    console.log('Showing note popup...');
    
    // Show note input popup
    const popupShown = await showNoteInputPopup(tab);
    console.log('Popup result:', popupShown);
    
    if (!popupShown) {
      console.log('Popup failed, falling back to direct save');
      // Fallback: save without note if popup fails
      const bookmarkData = createBookmarkRecord(tab);
      const result = await saveBookmarkLocally(bookmarkData);
      
      if (result.success) {
        await updateIconForTab(tab.id, tab.url);
        
        const settingsResult = await getFromLocalStorage('settings');
        const showNotifications = settingsResult.data?.showNotifications !== false;
        
        if (showNotifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Bookmark Saved',
            message: `Bookmark saved: ${tab.title}`
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error in extension icon click handler:', error);
  }
});

// Periodic cleanup and maintenance
setInterval(async () => {
  try {
    const countResult = await getBookmarksCount();
    if (countResult.success) {
      console.log(`Current bookmarks count: ${countResult.count}`);
    }
  } catch (error) {
    console.error('Error in periodic maintenance:', error);
  }
}, 300000); // Check every 5 minutes