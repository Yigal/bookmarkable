# 🧪 Testing Your Chrome Extension

## Quick Test Guide

### 1. Load Extension in Chrome (Developer Mode)

1. **Open Chrome Extensions Page**:
   - Type `chrome://extensions/` in address bar
   - Or go to Chrome Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**:
   - Toggle "Developer mode" switch in top-right corner

3. **Load Your Extension**:
   - Click **"Load unpacked"** button
   - Navigate to and select: `/Users/yigalweinberger/Documents/Code/home_code/bookmarks/extension`
   - ⚠️ **Important**: Select the `extension` folder, NOT the `dist` folder or ZIP file

4. **Verify Extension Loaded**:
   - You should see "Bookmark Sync" extension card
   - Extension icon should appear in Chrome toolbar

### 2. Test Extension Functionality

1. **Test Popup**:
   - Click the Bookmark Sync icon in Chrome toolbar
   - Popup should open showing current page info
   - Buttons should be enabled

2. **Test Bookmark Saving**:
   - Navigate to any website
   - Click extension icon
   - Click "Save Bookmark" or "Save with Tags"
   - Should show success message

3. **Test Web Interface**:
   - Start your web app: `cd webapp && npm run dev`
   - Open `http://localhost:3000`
   - Should see your saved bookmarks

### 3. Common Issues & Solutions

#### "Manifest file is missing or unreadable"
- ✅ **Solution**: Load the `extension` folder, not the ZIP file or `dist` folder
- ✅ **Correct path**: `/Users/yigalweinberger/Documents/Code/home_code/bookmarks/extension`

#### Extension icon doesn't appear
- Check Console (F12) for JavaScript errors
- Verify all files are present in extension folder
- Try reloading the extension (click refresh icon on extension card)

#### Popup doesn't open
- Right-click extension icon → "Inspect popup" to see errors
- Check if popup.html, popup.js, and popup.css are in extension folder

#### Can't save bookmarks
- Make sure web app is running on `http://localhost:3000`
- Check Network tab in DevTools for API call errors
- Verify CORS is properly configured in webapp

### 4. Development Workflow

```bash
# Start web app
cd /Users/yigalweinberger/Documents/Code/home_code/bookmarks/webapp
npm run dev

# After making changes to extension files:
# 1. Go to chrome://extensions/
# 2. Click reload icon on your extension
# 3. Test changes
```

### 5. File Structure Reference

Your extension should have this structure:
```
extension/
├── manifest.json       ✅ Main extension config
├── popup.html         ✅ Extension popup UI
├── popup.css          ✅ Popup styles  
├── popup.js           ✅ Popup functionality
├── background.js      ✅ Background service worker
├── content.js         ✅ Content script
├── privacy-policy.md  ✅ Privacy policy
└── icons/             ✅ Extension icons
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### 6. Debug Tools

- **Extension Popup**: Right-click extension icon → "Inspect popup"
- **Background Script**: Go to chrome://extensions/ → Click "service worker" link
- **Content Script**: Use regular DevTools on any page
- **Extension Management**: chrome://extensions/

### 7. Before Publishing

- [ ] Test on multiple websites
- [ ] Test bookmark saving with and without tags
- [ ] Test web interface at localhost:3000
- [ ] Verify no console errors
- [ ] Test extension reload/restart
- [ ] Take screenshots for Chrome Web Store

## Ready for Chrome Web Store?

Once testing is complete, use the ZIP file in the `dist` folder:
`/Users/yigalweinberger/Documents/Code/home_code/bookmarks/dist/bookmark-sync-extension-v1.0.0.zip`

This ZIP file is what you upload to the Chrome Web Store, NOT what you use for local testing.
