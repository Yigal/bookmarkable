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

const extractTextContent = (maxLength = 800) => {
  try {
    // Get main content, avoiding navigation and footer elements
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.story-content',
      '.blog-content',
      '#content',
      '[role="main"]'
    ];
    
    let content = '';
    let contentElement = null;
    
    // Try to find the main content element
    for (const selector of contentSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          contentElement = element;
          content = element.textContent || element.innerText || '';
          break;
        }
      } catch (error) {
        console.log(`Content selector error for ${selector}:`, error);
        continue;
      }
    }
    
    // Fallback: try to find the largest text block
    if (!content || content.length < 100) {
      try {
        const textElements = Array.from(document.querySelectorAll('p, div, section'))
          .filter(el => {
            const text = el.textContent || '';
            // Filter out navigation, sidebar, and footer content
            const parentClasses = el.parentElement ? el.parentElement.className.toLowerCase() : '';
            const isNavigation = /nav|menu|sidebar|footer|header|ads?|social|share|comment/.test(parentClasses + ' ' + el.className.toLowerCase());
            return text.length > 50 && !isNavigation;
          })
          .sort((a, b) => (b.textContent || '').length - (a.textContent || '').length);
        
        if (textElements.length > 0) {
          content = textElements[0].textContent || '';
        }
      } catch (error) {
        console.log('Fallback text extraction error:', error);
      }
    }
    
    // Final fallback to body content if no main content found
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
        .replace(/[\r\n\t]/g, ' ')
        .trim()
        .substring(0, maxLength)
        + (content.length > maxLength ? '...' : '');
    } catch (error) {
      console.log('Content cleaning error:', error);
      return content || '';
    }
    
  } catch (error) {
    console.log('Text content extraction error:', error);
    return '';
  }
};

// New function to extract the primary image from the page
const extractPrimaryImage = () => {
  try {
    // Try different methods to find the main image
    const imageSelectors = [
      // Open Graph and Twitter images (highest priority)
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      // Main content images
      'main img',
      'article img',
      '.content img:first-of-type',
      '.main-content img:first-of-type',
      '.post-content img:first-of-type',
      '.entry-content img:first-of-type',
      '.article-content img:first-of-type',
      // Hero images
      '.hero img',
      '.banner img',
      '.featured-image img',
      '.post-thumbnail img',
      // General fallback
      'img[src*="featured"]',
      'img[src*="hero"]',
      'img[src*="banner"]'
    ];
    
    for (const selector of imageSelectors) {
      try {
        if (selector.startsWith('meta')) {
          // Handle meta tags
          const meta = document.querySelector(selector);
          if (meta) {
            const imageUrl = meta.getAttribute('content');
            if (imageUrl && isValidImageUrl(imageUrl)) {
              return makeAbsoluteUrl(imageUrl);
            }
          }
        } else {
          // Handle img elements
          const img = document.querySelector(selector);
          if (img && img.src && isValidImageUrl(img.src)) {
            // Check if image is reasonably sized (not tiny icons)
            if (img.naturalWidth >= 200 && img.naturalHeight >= 100) {
              return img.src;
            }
            // If natural dimensions aren't available, try CSS dimensions
            const computedStyle = window.getComputedStyle(img);
            const width = parseInt(computedStyle.width) || 0;
            const height = parseInt(computedStyle.height) || 0;
            if (width >= 200 && height >= 100) {
              return img.src;
            }
          }
        }
      } catch (error) {
        console.log(`Image selector error for ${selector}:`, error);
        continue;
      }
    }
    
    // Final fallback: find the largest image on the page
    try {
      const allImages = Array.from(document.querySelectorAll('img'))
        .filter(img => {
          if (!img.src || !isValidImageUrl(img.src)) return false;
          
          // Filter out small images (likely icons or ads)
          const width = img.naturalWidth || parseInt(window.getComputedStyle(img).width) || 0;
          const height = img.naturalHeight || parseInt(window.getComputedStyle(img).height) || 0;
          
          // Skip very small images
          if (width < 100 || height < 100) return false;
          
          // Skip images that look like ads or social icons
          const src = img.src.toLowerCase();
          const isAd = /\b(ad|banner|sponsor|promo)\b/.test(src);
          const isSocial = /\b(facebook|twitter|instagram|linkedin|youtube|social)\b/.test(src);
          
          return !isAd && !isSocial;
        })
        .sort((a, b) => {
          const aSize = (a.naturalWidth || 0) * (a.naturalHeight || 0);
          const bSize = (b.naturalWidth || 0) * (b.naturalHeight || 0);
          return bSize - aSize; // Sort by size, largest first
        });
      
      if (allImages.length > 0) {
        return allImages[0].src;
      }
    } catch (error) {
      console.log('Fallback image extraction error:', error);
    }
    
    return null;
  } catch (error) {
    console.log('Primary image extraction error:', error);
    return null;
  }
};

// Helper function to validate image URLs
const isValidImageUrl = (url) => {
  try {
    if (!url || typeof url !== 'string') return false;
    
    // Check for valid image extensions
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)($|\?)/i;
    const hasImageExtension = imageExtensions.test(url);
    
    // Check for data URLs (base64 images)
    const isDataUrl = url.startsWith('data:image/');
    
    // Check for valid HTTP/HTTPS URLs
    const isHttpUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
    
    // Check for relative URLs
    const isRelativeUrl = url.startsWith('/') && !url.startsWith('//');
    
    return (hasImageExtension || isDataUrl) && (isHttpUrl || isRelativeUrl);
  } catch (error) {
    console.log('Image URL validation error:', error);
    return false;
  }
};

// Helper function to make URLs absolute
const makeAbsoluteUrl = (url) => {
  try {
    if (!url) return url;
    
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Protocol-relative
    if (url.startsWith('//')) {
      return window.location.protocol + url;
    }
    
    // Root-relative
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    
    // Relative to current path
    const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    return base + url;
  } catch (error) {
    console.log('URL absolute conversion error:', error);
    return url;
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
          const primaryImage = extractPrimaryImage();
          
          return {
            success: true,
            data: {
              ...metadata,
              textContent,
              primaryImage,
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
