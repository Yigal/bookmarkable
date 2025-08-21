// Content script for enhanced bookmark data capture
// Following functional programming principles

// Pure functions for page data extraction
const extractPageMetadata = () => {
  try {
    const getMetaContent = (name) => {
      try {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta ? meta.getAttribute('content') : null;
      } catch (error) {
        console.log(`Meta content error for ${name}:`, error);
        return null;
      }
    };
    
    const getCanonicalUrl = () => {
      try {
        const canonical = document.querySelector('link[rel="canonical"]');
        return canonical ? canonical.href : window.location.href;
      } catch (error) {
        console.log('Canonical URL error:', error);
        return window.location.href;
      }
    };
    
    const extractKeywords = () => {
      try {
        const keywords = getMetaContent('keywords');
        return keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];
      } catch (error) {
        console.log('Keywords extraction error:', error);
        return [];
      }
    };
    
    const extractTags = () => {
      try {
        // Try to extract tags from common patterns
        const tagSelectors = [
          '.tags a',
          '.tag-list a',
          '[class*="tag"] a',
          '.categories a',
          '.labels a'
        ];
        
        const tags = new Set();
        
        tagSelectors.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(element => {
              const text = element.textContent.trim();
              if (text && text.length < 50) {
                tags.add(text);
              }
            });
          } catch (error) {
            console.log(`Tag selector error for ${selector}:`, error);
          }
        });
        
        return Array.from(tags);
      } catch (error) {
        console.log('Tags extraction error:', error);
        return [];
      }
    };
    
    const metadata = {
      title: document.title || 'Untitled',
      url: getCanonicalUrl(),
      description: getMetaContent('description') || getMetaContent('og:description'),
      keywords: extractKeywords(),
      suggestedTags: extractTags(),
      author: getMetaContent('author'),
      publishedDate: getMetaContent('article:published_time') || getMetaContent('date'),
      image: getMetaContent('og:image') || getMetaContent('twitter:image'),
      siteName: getMetaContent('og:site_name'),
      type: getMetaContent('og:type') || 'website'
    };
    
    console.log('Extracted metadata:', metadata);
    return metadata;
    
  } catch (error) {
    console.log('Metadata extraction error:', error);
    return {
      title: document.title || 'Untitled',
      url: window.location.href,
      description: 'Error extracting metadata',
      keywords: [],
      suggestedTags: [],
      author: null,
      publishedDate: null,
      image: null,
      siteName: null,
      type: 'website'
    };
  }
};

const extractTextContent = (maxLength = 500) => {
  try {
    // Get main content, avoiding navigation and footer elements
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content'
    ];
    
    let content = '';
    
    for (const selector of contentSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          content = element.textContent || element.innerText || '';
          break;
        }
      } catch (error) {
        console.log(`Content selector error for ${selector}:`, error);
        continue;
      }
    }
    
    // Fallback to body content if no main content found
    if (!content) {
      try {
        content = document.body.textContent || document.body.innerText || '';
      } catch (error) {
        console.log('Body content fallback error:', error);
        content = '';
      }
    }
    
    // Clean and truncate content
    try {
      return content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, maxLength);
    } catch (error) {
      console.log('Content cleaning error:', error);
      return content || '';
    }
    
  } catch (error) {
    console.log('Text content extraction error:', error);
    return '';
  }
};

const isBookmarkableUrl = (url) => {
  try {
    // Check if URL is valid
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    const unbookmarkablePatterns = [
      /^chrome:/,
      /^chrome-extension:/,
      /^moz-extension:/,
      /^about:/,
      /^data:/,
      /^javascript:/
    ];
    
    const isUnbookmarkable = unbookmarkablePatterns.some(pattern => pattern.test(url));
    const isBookmarkable = !isUnbookmarkable && url.startsWith('http');
    
    console.log('URL check:', { url, isBookmarkable, isUnbookmarkable });
    
    return isBookmarkable;
  } catch (error) {
    console.log('URL validation error:', error);
    return false;
  }
};

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleContentMessage = async () => {
    try {
      switch (request.action) {
        case 'getPageMetadata':
          if (!isBookmarkableUrl(window.location.href)) {
            return { success: false, error: 'URL not bookmarkable' };
          }
          
          const metadata = extractPageMetadata();
          const textContent = extractTextContent();
          
          return {
            success: true,
            data: {
              ...metadata,
              textContent,
              capturedAt: new Date().toISOString()
            }
          };
          
        case 'highlightSelection':
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          
          if (selectedText) {
            return {
              success: true,
              data: {
                selectedText,
                selectedHtml: selection.rangeCount > 0 
                  ? selection.getRangeAt(0).cloneContents() 
                  : null
              }
            };
          }
          
          return { success: false, error: 'No text selected' };
          
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      console.log('Message handler error:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Handle async responses
  handleContentMessage().then(sendResponse).catch(error => {
    console.log('Message response error:', error);
    sendResponse({ success: false, error: error.message });
  });
  return true; // Keep message channel open for async response
});

// Auto-capture functionality
const autoCapture = () => {
  try {
    // Only auto-capture if the page has been idle for a while
    let idleTimer;
    let hasUserInteracted = false;
    
    const resetIdleTimer = () => {
      try {
        clearTimeout(idleTimer);
        hasUserInteracted = true;
        
        idleTimer = setTimeout(() => {
          try {
            if (hasUserInteracted && isBookmarkableUrl(window.location.href)) {
              // Send page data to background script for potential auto-save
              const metadata = extractPageMetadata();
              chrome.runtime.sendMessage({
                action: 'pageIdle',
                data: metadata
              }).catch(error => {
                console.log('Auto-capture message error:', error);
              });
            }
          } catch (error) {
            console.log('Auto-capture timer error:', error);
          }
        }, 30000); // 30 seconds of idle time
      } catch (error) {
        console.log('Reset timer error:', error);
      }
    };
    
    // Set up event listeners for user interaction
    ['scroll', 'click', 'keydown', 'mousemove'].forEach(event => {
      try {
        document.addEventListener(event, resetIdleTimer, { passive: true });
      } catch (error) {
        console.log(`Event listener error for ${event}:`, error);
      }
    });
    
    // Start the idle timer
    resetIdleTimer();
  } catch (error) {
    console.log('Auto-capture initialization error:', error);
  }
};

// Initialize auto-capture when DOM is ready
try {
  console.log('Content script initialized for:', window.location.href);
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded, starting auto-capture');
      autoCapture();
    });
  } else {
    console.log('DOM already loaded, starting auto-capture');
    autoCapture();
  }
} catch (error) {
  console.log('Content script initialization error:', error);
}
